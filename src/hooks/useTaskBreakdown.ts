import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskProgress {
  task_instance_id: string;
  task_name: string;
  task_icon: string;
  scoring_type: string;
  max_points: number;
  user_points: number;
  opponent_points: number;
  user_completed: boolean;
  opponent_completed: boolean;
}

interface UseTaskBreakdownOptions {
  seasonId?: string;
  weekId?: string;
  userId?: string;
  opponentId?: string;
}

export function useTaskBreakdown({ seasonId, weekId, userId, opponentId }: UseTaskBreakdownOptions) {
  const queryClient = useQueryClient();
  const queryKey = ['task-breakdown', seasonId, weekId, userId, opponentId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<TaskProgress[]> => {
      if (!seasonId || !weekId || !userId || !opponentId) return [];

      // 1. Get all task instances for the season
      const { data: taskInstances, error: taskError } = await supabase
        .from('task_instances')
        .select(`
          id,
          task_name,
          scoring_type,
          config,
          league_task_config_id,
          league_task_configs (
            max_daily_points,
            task_templates (
              icon
            )
          )
        `)
        .eq('season_id', seasonId);

      if (taskError) throw taskError;

      // 2. Get scoring events for both users this week
      const { data: scoringEvents, error: scoreError } = await supabase
        .from('scoring_events')
        .select('task_instance_id, user_id, points_awarded')
        .eq('week_id', weekId)
        .in('user_id', [userId, opponentId]);

      if (scoreError) throw scoreError;

      // 3. Aggregate points by task and user
      const userPointsMap = new Map<string, number>();
      const opponentPointsMap = new Map<string, number>();

      (scoringEvents || []).forEach((event) => {
        const taskId = event.task_instance_id;
        if (!taskId) return;

        if (event.user_id === userId) {
          userPointsMap.set(taskId, (userPointsMap.get(taskId) || 0) + Number(event.points_awarded));
        } else if (event.user_id === opponentId) {
          opponentPointsMap.set(taskId, (opponentPointsMap.get(taskId) || 0) + Number(event.points_awarded));
        }
      });

      // 4. Build task progress list
      const taskProgress: TaskProgress[] = (taskInstances || []).map((task) => {
        const config = task.league_task_configs as any;
        const maxPoints = config?.max_daily_points || 100;
        const icon = config?.task_templates?.icon || '📋';
        const userPoints = userPointsMap.get(task.id) || 0;
        const opponentPoints = opponentPointsMap.get(task.id) || 0;

        return {
          task_instance_id: task.id,
          task_name: task.task_name,
          task_icon: icon,
          scoring_type: task.scoring_type,
          max_points: maxPoints,
          user_points: userPoints,
          opponent_points: opponentPoints,
          user_completed: userPoints > 0,
          opponent_completed: opponentPoints > 0,
        };
      });

      // Sort by user's lead (tasks where user is winning first)
      taskProgress.sort((a, b) => {
        const aDiff = a.user_points - a.opponent_points;
        const bDiff = b.user_points - b.opponent_points;
        return bDiff - aDiff;
      });

      return taskProgress;
    },
    enabled: !!seasonId && !!weekId && !!userId && !!opponentId,
    staleTime: 30000,
  });

  // Real-time subscription for scoring events
  useEffect(() => {
    if (!weekId || !userId || !opponentId) return;

    const channel = supabase
      .channel(`task-breakdown-${weekId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scoring_events',
          filter: `week_id=eq.${weekId}`,
        },
        (payload) => {
          const event = (payload.new || payload.old) as any;
          if (event?.user_id === userId || event?.user_id === opponentId) {
            queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekId, userId, opponentId, queryClient, queryKey]);

  return query;
}
