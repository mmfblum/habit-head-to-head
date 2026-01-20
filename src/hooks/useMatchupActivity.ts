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

  const queryKey = ['matchup-activity', weekId, userIds.sort().join(',')];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!weekId || userIds.length === 0) return [];

      // Fetch scoring events with task and profile info
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
        .in('user_id', userIds)
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
    enabled: enabled && !!weekId && userIds.length > 0,
    staleTime: 30000,
  });

  // Real-time subscription for new scoring events
  useEffect(() => {
    if (!weekId || userIds.length === 0 || !enabled) return;

    const channel = supabase
      .channel(`matchup-activity-${weekId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scoring_events',
          filter: `week_id=eq.${weekId}`,
        },
        async (payload) => {
          const newEvent = payload.new as any;
          
          // Only process if it's one of our users
          if (!userIds.includes(newEvent.user_id)) return;

          // Fetch full event data with relations
          const { data: fullEvent } = await supabase
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
            .eq('id', newEvent.id)
            .single();

          if (fullEvent) {
            const taskConfig = (fullEvent.task_instances as any)?.league_task_configs;
            const template = taskConfig?.task_templates;
            const profile = fullEvent.profiles as { display_name: string | null; avatar_url: string | null } | null;

            const activityEvent: ActivityEvent = {
              id: fullEvent.id,
              user_id: fullEvent.user_id || '',
              display_name: profile?.display_name || 'Unknown',
              avatar_url: profile?.avatar_url || null,
              task_name: template?.name || 'Task',
              task_icon: template?.icon || '📋',
              points_awarded: fullEvent.points_awarded,
              created_at: fullEvent.created_at,
              scoring_type: fullEvent.scoring_type,
            };

            // Prepend new event to the cache
            queryClient.setQueryData<ActivityEvent[]>(queryKey, (old) => {
              if (!old) return [activityEvent];
              // Avoid duplicates
              if (old.some(e => e.id === activityEvent.id)) return old;
              return [activityEvent, ...old].slice(0, PAGE_SIZE * 2);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekId, userIds, enabled, queryClient, queryKey]);

  const setIsAtTop = useCallback((atTop: boolean) => {
    isAtTopRef.current = atTop;
  }, []);

  return {
    ...query,
    setIsAtTop,
    isAtTop: isAtTopRef.current,
  };
}

// Hook for real-time weekly scores
export function useMatchupScores(weekId?: string, userIds: string[] = []) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['matchup-scores', weekId, userIds.sort().join(',')],
    queryFn: async () => {
      if (!weekId || userIds.length === 0) return new Map<string, number>();

      const { data, error } = await supabase
        .from('weekly_scores')
        .select('user_id, total_points')
        .eq('week_id', weekId)
        .in('user_id', userIds);

      if (error) throw error;

      const scoresMap = new Map<string, number>();
      (data || []).forEach(row => {
        scoresMap.set(row.user_id, row.total_points);
      });
      return scoresMap;
    },
    enabled: !!weekId && userIds.length > 0,
    staleTime: 10000,
  });

  // Real-time subscription for score updates
  useEffect(() => {
    if (!weekId || userIds.length === 0) return;

    const channel = supabase
      .channel(`matchup-scores-${weekId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_scores',
          filter: `week_id=eq.${weekId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (userIds.includes(updated?.user_id)) {
            queryClient.invalidateQueries({ 
              queryKey: ['matchup-scores', weekId, userIds.sort().join(',')] 
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekId, userIds, queryClient]);

  return query;
}
