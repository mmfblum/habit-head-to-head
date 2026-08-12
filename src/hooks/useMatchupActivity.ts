import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityEvent {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  task_name: string;
  task_icon: string;
  points_awarded: number;
  created_at: string;
  scoring_type: string;
}

interface UseMatchupActivityOptions {
  weekId?: string;
  userIds: string[];
  enabled?: boolean;
}

const PAGE_SIZE = 20;

export function useMatchupActivity({ weekId, userIds, enabled = true }: UseMatchupActivityOptions) {
  const queryClient = useQueryClient();
  const isAtTopRef = useRef(true);
  const normalizedUserIds = [...userIds].sort();
  const userKey = normalizedUserIds.join(',');
  const queryKey = ['matchup-activity', weekId, userKey];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!weekId || normalizedUserIds.length === 0) return [];

      const { data: events, error } = await supabase
        .from('scoring_events')
        .select(`
          id,
          user_id,
          points_awarded,
          scoring_type,
          created_at,
          task_instance_id,
          task_instances!scoring_events_task_instance_id_fkey (
            league_task_configs (
              task_templates (
                name,
                icon
              )
            )
          ),
          profiles!scoring_events_user_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .eq('week_id', weekId)
        .eq('is_reversed', false)
        .in('user_id', normalizedUserIds)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      return (events || []).map((event) => {
        const taskConfig = (event.task_instances as any)?.league_task_configs;
        const template = taskConfig?.task_templates;
        const profile = event.profiles as { display_name: string | null; avatar_url: string | null } | null;

        return {
          id: event.id,
          user_id: event.user_id || '',
          display_name: profile?.display_name || 'Unknown',
          avatar_url: profile?.avatar_url || null,
          task_name: template?.name || 'Task',
          task_icon: template?.icon || '📋',
          points_awarded: event.points_awarded,
          created_at: event.created_at,
          scoring_type: event.scoring_type,
        };
      });
    },
    enabled: enabled && !!weekId && normalizedUserIds.length > 0,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!weekId || normalizedUserIds.length === 0 || !enabled) return;

    const channel = supabase
      .channel(`matchup-activity-${weekId}-${userKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scoring_events',
          filter: `week_id=eq.${weekId}`,
        },
        (payload) => {
          const changed = (payload.new || payload.old) as any;
          if (normalizedUserIds.includes(changed?.user_id)) {
            queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekId, userKey, enabled, queryClient]);

  const setIsAtTop = useCallback((atTop: boolean) => {
    isAtTopRef.current = atTop;
  }, []);

  return {
    ...query,
    setIsAtTop,
    isAtTop: isAtTopRef.current,
  };
}

export function useMatchupScores(weekId?: string, userIds: string[] = []) {
  const queryClient = useQueryClient();
  const normalizedUserIds = [...userIds].sort();
  const userKey = normalizedUserIds.join(',');
  const queryKey = ['matchup-scores', weekId, userKey];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!weekId || normalizedUserIds.length === 0) return new Map<string, number>();

      const { data, error } = await supabase
        .from('weekly_scores')
        .select('user_id, total_points')
        .eq('week_id', weekId)
        .in('user_id', normalizedUserIds);

      if (error) throw error;

      const scoresMap = new Map<string, number>();
      (data || []).forEach(row => {
        scoresMap.set(row.user_id, row.total_points);
      });
      return scoresMap;
    },
    enabled: !!weekId && normalizedUserIds.length > 0,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!weekId || normalizedUserIds.length === 0) return;

    const channel = supabase
      .channel(`matchup-scores-${weekId}-${userKey}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_scores',
          filter: `week_id=eq.${weekId}`,
        },
        (payload) => {
          const changed = (payload.new || payload.old) as any;
          if (normalizedUserIds.includes(changed?.user_id)) {
            queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekId, userKey, queryClient]);

  return query;
}
