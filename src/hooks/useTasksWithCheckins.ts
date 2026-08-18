import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import type { TaskWithTemplate, CheckinValue } from '@/types/checkin';
import type { Tables } from '@/integrations/supabase/types';

type TaskInstance = Tables<'task_instances'>;
type TaskTemplate = Tables<'task_templates'>;
type DailyCheckin = Tables<'daily_checkins'>;
type ScoringEvent = Tables<'scoring_events'>;

interface TaskInstanceWithRelations extends TaskInstance {
  league_task_config?: {
    task_template: TaskTemplate;
  } | null;
}

export interface SubmitCheckinResult {
  checkin: DailyCheckin;
  scoringEvent: Pick<ScoringEvent, 'points_awarded' | 'points_before_cap' | 'powerup_applied' | 'rule_applied'> | null;
}

export function useTasksWithCheckins(seasonId: string | undefined, date?: Date) {
  const { user } = useAuth();
  const checkinDate = format(date ?? new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['tasks-with-checkins', seasonId, checkinDate, user?.id],
    queryFn: async (): Promise<TaskWithTemplate[]> => {
      if (!seasonId || !user?.id) return [];

      const { data: taskInstances, error: taskError } = await supabase
        .from('task_instances')
        .select(`
          *,
          league_task_config:league_task_configs(
            task_template:task_templates(*)
          )
        `)
        .eq('season_id', seasonId);

      if (taskError) throw taskError;

      const instanceIds = taskInstances?.map((task) => task.id) || [];
      let checkins: DailyCheckin[] = [];

      if (instanceIds.length > 0) {
        const { data, error: checkinError } = await supabase
          .from('daily_checkins')
          .select('*')
          .eq('user_id', user.id)
          .eq('checkin_date', checkinDate)
          .in('task_instance_id', instanceIds);

        if (checkinError) throw checkinError;
        checkins = data || [];
      }

      return (taskInstances as TaskInstanceWithRelations[] || []).map((task) => ({
        ...task,
        template: task.league_task_config?.task_template,
        todayCheckin: checkins.find((checkin) => checkin.task_instance_id === task.id),
      }));
    },
    enabled: !!seasonId && !!user?.id,
  });
}

export function useSubmitCheckin() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskInstanceId,
      value,
      date,
    }: {
      taskInstanceId: string;
      value: CheckinValue;
      date?: Date;
    }): Promise<SubmitCheckinResult> => {
      if (!user?.id) throw new Error('Must be logged in');

      const checkinDate = format(date ?? new Date(), 'yyyy-MM-dd');
      const { data: existing } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('task_instance_id', taskInstanceId)
        .eq('user_id', user.id)
        .eq('checkin_date', checkinDate)
        .maybeSingle();

      const baseData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (value.boolean_value !== undefined) baseData.boolean_value = value.boolean_value;
      if (value.numeric_value !== undefined) baseData.numeric_value = value.numeric_value;
      if (value.time_value !== undefined && value.time_value !== '') baseData.time_value = value.time_value;
      if (value.duration_minutes !== undefined) baseData.duration_minutes = value.duration_minutes;
      if (value.metadata !== undefined) baseData.metadata = value.metadata;

      let savedCheckin: DailyCheckin;

      if (existing) {
        const { data, error } = await supabase
          .from('daily_checkins')
          .update(baseData)
          .eq('id', existing.id)
          .select('*')
          .single();
        if (error) throw error;
        savedCheckin = data;
      } else {
        const { data, error } = await supabase
          .from('daily_checkins')
          .insert({
            task_instance_id: taskInstanceId,
            user_id: user.id,
            checkin_date: checkinDate,
            ...baseData,
          } as never)
          .select('*')
          .single();
        if (error) throw error;
        savedCheckin = data;
      }

      // The scoring trigger runs synchronously with the write, so the resulting
      // audit event is available before the mutation returns. Failure to read
      // the celebration metadata must never turn a successful check-in into an error.
      const { data: scoringEvent } = await supabase
        .from('scoring_events')
        .select('points_awarded, points_before_cap, powerup_applied, rule_applied')
        .eq('daily_checkin_id', savedCheckin.id)
        .eq('is_reversed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return { checkin: savedCheckin, scoringEvent };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-with-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-scores'] });
      queryClient.invalidateQueries({ queryKey: ['current-matchup'] });
      queryClient.invalidateQueries({ queryKey: ['matchup-activity'] });
      queryClient.invalidateQueries({ queryKey: ['task-breakdown'] });
    },
  });
}
