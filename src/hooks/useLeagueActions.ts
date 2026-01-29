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

      // Check if user is admin/owner
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

      // Delete in order to respect foreign key constraints:
      // 1. Get all seasons for this league
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .eq('league_id', leagueId);

      if (seasons && seasons.length > 0) {
        const seasonIds = seasons.map(s => s.id);

        // 2. Get all weeks for these seasons
        const { data: weeks } = await supabase
          .from('weeks')
          .select('id')
          .in('season_id', seasonIds);

        if (weeks && weeks.length > 0) {
          const weekIds = weeks.map(w => w.id);

          // 3. Delete weekly_scores
          await supabase
            .from('weekly_scores')
            .delete()
            .in('week_id', weekIds);

          // 4. Delete matchups
          await supabase
            .from('matchups')
            .delete()
            .in('week_id', weekIds);

          // 5. Delete powerups
          await supabase
            .from('powerups')
            .delete()
            .in('week_id', weekIds);

          // 6. Delete punishments
          await supabase
            .from('punishments')
            .delete()
            .eq('league_id', leagueId);

          // 7. Delete weeks
          await supabase
            .from('weeks')
            .delete()
            .in('season_id', seasonIds);
        }

        // 8. Get all task instances for these seasons
        const { data: taskInstances } = await supabase
          .from('task_instances')
          .select('id')
          .in('season_id', seasonIds);

        if (taskInstances && taskInstances.length > 0) {
          const taskInstanceIds = taskInstances.map(t => t.id);

          // 9. Delete daily_checkins
          await supabase
            .from('daily_checkins')
            .delete()
            .in('task_instance_id', taskInstanceIds);

          // 10. Delete scoring_events
          await supabase
            .from('scoring_events')
            .delete()
            .in('task_instance_id', taskInstanceIds);

          // 11. Delete task_instances
          await supabase
            .from('task_instances')
            .delete()
            .in('season_id', seasonIds);
        }

        // 12. Delete league_task_configs
        await supabase
          .from('league_task_configs')
          .delete()
          .in('season_id', seasonIds);

        // 13. Delete user_custom_tasks
        await supabase
          .from('user_custom_tasks')
          .delete()
          .in('season_id', seasonIds);

        // 14. Delete season_standings
        await supabase
          .from('season_standings')
          .delete()
          .in('season_id', seasonIds);

        // 15. Delete seasons
        await supabase
          .from('seasons')
          .delete()
          .eq('league_id', leagueId);
      }

      // 16. Delete league_members
      const { error: membersDeleteError } = await supabase
        .from('league_members')
        .delete()
        .eq('league_id', leagueId);

      if (membersDeleteError) throw membersDeleteError;

      // 17. Finally delete the league
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

      // Check if user is owner - owners cannot leave, they must delete
      const { data: membership, error: memberError } = await supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .single();

      if (memberError) throw memberError;
      if (membership.role === 'owner') {
        throw new Error('League owners cannot leave. Delete the league instead.');
      }

      // Delete the membership
      const { error: deleteError } = await supabase
        .from('league_members')
        .delete()
        .eq('league_id', leagueId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Left league successfully');
      queryClient.invalidateQueries({ queryKey: ['user-leagues'] });
      queryClient.invalidateQueries({ queryKey: ['league-details'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to leave league');
    },
  });
}
