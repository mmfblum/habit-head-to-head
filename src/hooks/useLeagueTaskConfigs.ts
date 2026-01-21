import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

export type LeagueTaskConfig = Tables<'league_task_configs'> & {
  task_template: Tables<'task_templates'> | null;
};

// Track recent local mutations to avoid showing toasts for own changes
const recentLocalChanges = new Set<string>();

export function useLeagueTaskConfigs(seasonId?: string) {
  const queryClient = useQueryClient();

  // Subscribe to realtime changes
  useEffect(() => {
    if (!seasonId) return;

    const channel = supabase
      .channel(`league-task-configs-${seasonId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_task_configs',
          filter: `season_id=eq.${seasonId}`,
        },
        (payload) => {
          console.log('Task config changed:', payload);
          
          // Check if this was a local change we just made
          const changeKey = `${payload.eventType}-${(payload.new as any)?.id || (payload.old as any)?.id}`;
          if (recentLocalChanges.has(changeKey)) {
            recentLocalChanges.delete(changeKey);
            // Still invalidate, but don't show toast for own changes
            queryClient.invalidateQueries({ queryKey: ['league-task-configs', seasonId] });
            return;
          }
          
          // Show toast for remote changes
          const eventType = payload.eventType;
          if (eventType === 'INSERT') {
            toast.info('Task added', {
              description: 'A league admin added a new task',
              icon: '➕',
            });
          } else if (eventType === 'UPDATE') {
            toast.info('Task updated', {
              description: 'A league admin updated task settings',
              icon: '✏️',
            });
          } else if (eventType === 'DELETE') {
            toast.info('Task removed', {
              description: 'A league admin removed a task',
              icon: '🗑️',
            });
          }
          
          // Invalidate and refetch
          queryClient.invalidateQueries({ queryKey: ['league-task-configs', seasonId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seasonId, queryClient]);

  return useQuery({
    queryKey: ['league-task-configs', seasonId],
    queryFn: async (): Promise<LeagueTaskConfig[]> => {
      if (!seasonId) return [];

      const { data, error } = await supabase
        .from('league_task_configs')
        .select(`
          *,
          task_template:task_templates(*)
        `)
        .eq('season_id', seasonId)
        .order('display_order');

      if (error) throw error;
      return (data || []) as LeagueTaskConfig[];
    },
    enabled: !!seasonId,
  });
}

// Helper to mark a change as local (call before mutation)
export function markLocalChange(eventType: string, id: string) {
  recentLocalChanges.add(`${eventType}-${id}`);
  // Clean up after 5 seconds in case the realtime event never arrives
  setTimeout(() => recentLocalChanges.delete(`${eventType}-${id}`), 5000);
}

export function useUpdateTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      configId,
      updates,
    }: {
      configId: string;
      updates: {
        config_overrides?: Record<string, any>;
        max_daily_points?: number;
        is_enabled?: boolean;
      };
    }) => {
      // Mark this as a local change to avoid showing toast for own action
      markLocalChange('UPDATE', configId);
      
      const { data, error } = await supabase
        .from('league_task_configs')
        .update(updates)
        .eq('id', configId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-task-configs'] });
      queryClient.invalidateQueries({ queryKey: ['league-details'] });
    },
  });
}

export function useAddTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      seasonId,
      taskTemplateId,
      configOverrides,
      maxDailyPoints = 100,
    }: {
      seasonId: string;
      taskTemplateId: string;
      configOverrides?: Record<string, any>;
      maxDailyPoints?: number;
    }) => {
      // Get current max display_order
      const { data: existing } = await supabase
        .from('league_task_configs')
        .select('display_order')
        .eq('season_id', seasonId)
        .order('display_order', { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

      const { data, error } = await supabase
        .from('league_task_configs')
        .insert({
          season_id: seasonId,
          task_template_id: taskTemplateId,
          config_overrides: configOverrides || {},
          max_daily_points: maxDailyPoints,
          display_order: nextOrder,
          is_enabled: true,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Mark this as a local change to avoid showing toast for own action
      markLocalChange('INSERT', data.id);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-task-configs'] });
      queryClient.invalidateQueries({ queryKey: ['league-details'] });
    },
  });
}

export function useRemoveTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      // Mark this as a local change to avoid showing toast for own action
      markLocalChange('UPDATE', configId); // It's an UPDATE since we soft-delete
      
      // Soft delete by disabling instead of hard delete
      const { error } = await supabase
        .from('league_task_configs')
        .update({ is_enabled: false })
        .eq('id', configId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-task-configs'] });
      queryClient.invalidateQueries({ queryKey: ['league-details'] });
    },
  });
}

// Check if current user is admin of a league
export function useIsLeagueAdmin(leagueId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['is-league-admin', leagueId, user?.id],
    queryFn: async () => {
      if (!user || !leagueId) return false;

      const { data, error } = await supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .single();

      if (error) return false;
      return data?.role === 'owner' || data?.role === 'admin';
    },
    enabled: !!user && !!leagueId,
  });
}
