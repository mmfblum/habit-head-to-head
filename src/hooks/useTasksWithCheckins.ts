import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import type { TaskWithTemplate, CheckinValue } from '@/types/checkin';
import type { Tables } from '@/integrations/supabase/types';

type TaskInstance = Tables<'task_instances'>;
type TaskTemplate = Tables<'task_templates'>;
type DailyCheckin = Tables<'daily_checkins'>;

interface TaskInstanceWithRelations extends TaskInstance {
  league_task_config?: {
    task_template: TaskTemplate;
  } | null;
}

export function useTasksWithCheckins(seasonId: string | undefined, date?: Date) {
  const { user } = useAuth();
  const checkinDate = format(date ?? new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['tasks-with-checkins', seasonId, checkinDate, user?.id],
    queryFn: async (): Promise<TaskWithTemplate[]> => {
      if (!seasonId || !user?.id) return [];

      // Fetch task instances for this season with their template info
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

      // Fetch today's check-ins for current user
      const { data: checkins, error: checkinError } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('checkin_date', checkinDate)
        .in('task_instance_id', taskInstances?.map(t => t.id) || []);

      if (checkinError) throw checkinError;

      // Combine task instances with their check-ins and templates
      return (taskInstances as TaskInstanceWithRelations[] || []).map(task => ({
        ...task,
        template: task.league_task_config?.task_template,
        todayCheckin: checkins?.find(c => c.task_instance_id === task.id),
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
    }) => {
      if (!user?.id) throw new Error('Must be logged in');

      const checkinDate = format(date ?? new Date(), 'yyyy-MM-dd');

      // Check if there's an existing check-in for this task/date
      const { data: existing } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('task_instance_id', taskInstanceId)
        .eq('user_id', user.id)
        .eq('checkin_date', checkinDate)
        .single();

      if (existing) {
        // Update existing check-in
        const { error } = await supabase
          .from('daily_checkins')
          .update({
            ...value,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new check-in
        const { error } = await supabase
          .from('daily_checkins')
          .insert({
            task_instance_id: taskInstanceId,
            user_id: user.id,
            checkin_date: checkinDate,
            ...value,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks-with-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-scores'] });
    },
  });
}
