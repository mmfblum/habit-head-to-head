import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { LeagueGameFormat } from './useLeagues';

type StartSeasonInput = string | {
  seasonId: string;
  gameFormat?: LeagueGameFormat;
};

export function useStartSeason() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: StartSeasonInput) => {
      const seasonId = typeof input === 'string' ? input : input.seasonId;
      const gameFormat = typeof input === 'string' ? 'head_to_head' : input.gameFormat ?? 'head_to_head';

      const { error } = await supabase.rpc(
        'start_league_season' as never,
        { _season_id: seasonId } as never
      );

      if (error) throw error;
      return { success: true, gameFormat };
    },
    onSuccess: ({ gameFormat }) => {
      toast({
        title: 'Season Scheduled!',
        description: gameFormat === 'solo'
          ? 'Your Solo scorecard is live now. Start scoring today.'
          : gameFormat === 'leaderboard'
            ? 'The leaderboard opens Sunday. Everyone starts the week at zero.'
            : 'The head-to-head schedule is set. Week 1 kicks off Sunday.',
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
