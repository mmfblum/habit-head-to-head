import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useDeleteLeague() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leagueId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { data: membership, error: memberError } = await supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .single();

      if (memberError) throw memberError;
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        throw new Error('Only league owners and admins can delete the league');
      }

      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .eq('league_id', leagueId);

      if (seasons && seasons.length > 0) {
        const seasonIds = seasons.map(s => s.id);

        const { data: weeks } = await supabase
          .from('weeks')
          .select('id')
          .in('season_id', seasonIds);

        if (weeks && weeks.length > 0) {
          const weekIds = weeks.map(w => w.id);

          await supabase
            .from('weekly_scores')
            .delete()
            .in('week_id', weekIds);

          await supabase
            .from('matchups')
            .delete()
            .in('week_id', weekIds);

          await supabase
            .from('powerups')
            .delete()
            .in('week_id', weekIds);

          await supabase
            .from('punishments')
            .delete()
            .eq('league_id', leagueId);

          await supabase
            .from('weeks')
            .delete()
            .in('season_id', seasonIds);
        }

        const { data: taskInstances } = await supabase
          .from('task_instances')
          .select('id')
          .in('season_id', seasonIds);

        if (taskInstances && taskInstances.length > 0) {
          const taskInstanceIds = taskInstances.map(t => t.id);

          await supabase
            .from('daily_checkins')
            .delete()
            .in('task_instance_id', taskInstanceIds);

          await supabase
            .from('scoring_events')
            .delete()
            .in('task_instance_id', taskInstanceIds);

          await supabase
            .from('task_instances')
            .delete()
            .in('season_id', seasonIds);
        }

        await supabase
          .from('league_task_configs')
          .delete()
          .in('season_id', seasonIds);

        await supabase
          .from('user_custom_tasks')
          .delete()
          .in('season_id', seasonIds);

        await supabase
          .from('season_standings')
          .delete()
          .in('season_id', seasonIds);

        await supabase
          .from('seasons')
          .delete()
          .eq('league_id', leagueId);
      }

      const { error: membersDeleteError } = await supabase
        .from('league_members')
        .delete()
        .eq('league_id', leagueId);

      if (membersDeleteError) throw membersDeleteError;

      const { error: leagueDeleteError } = await supabase
        .from('leagues')
        .delete()
        .eq('id', leagueId);

      if (leagueDeleteError) throw leagueDeleteError;

      return { success: true };
    },
    onSuccess: () => {
      toast.success('League deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['user-leagues'] });
      queryClient.invalidateQueries({ queryKey: ['user-league-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['league-details'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete league');
    },
  });
}

export function useLeaveLeague() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leagueId: string) => {
      if (!user) throw new Error('Must be logged in');

      const { error } = await supabase.rpc(
        'leave_league' as never,
        { _league_id: leagueId } as never
      );

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Left league successfully');
      queryClient.invalidateQueries({ queryKey: ['user-leagues'] });
      queryClient.invalidateQueries({ queryKey: ['user-league-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['league-details'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to leave league');
    },
  });
}
