import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type LeagueTaskConfig = Tables<'league_task_configs'> & {
  task_template: Tables<'task_templates'>;
};

export function useLeagueTaskConfigs(seasonId?: string) {
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
