import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useStartSeason() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (seasonId: string) => {
      const { error } = await (supabase as any).rpc('start_league_season', {
        _season_id: seasonId,
      });

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: 'Season Scheduled!',
        description: 'The head-to-head schedule is set. Week 1 kicks off Sunday.',
      });
      queryClient.invalidateQueries({ queryKey: ['league-details'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-with-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['user-league-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['current-matchup'] });
      queryClient.invalidateQueries({ queryKey: ['week-matchups'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not schedule season',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
