import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RivalryStats {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  biggestWin: number;
  closestGame: number | null;
  streakType: 'W' | 'L' | 'T' | null;
  streakCount: number;
}

type MatchupRow = {
  user1_id: string;
  user2_id: string;
  user1_score: number;
  user2_score: number;
  winner_id: string | null;
  updated_at: string;
};

export function useRivalryStats(userId?: string, opponentId?: string) {
  return useQuery({
    queryKey: ['rivalry-stats', userId, opponentId],
    enabled: !!userId && !!opponentId,
    queryFn: async (): Promise<RivalryStats> => {
      if (!userId || !opponentId) {
        return { games: 0, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, biggestWin: 0, closestGame: null, streakType: null, streakCount: 0 };
      }

      const pairFilter = `and(user1_id.eq.${userId},user2_id.eq.${opponentId}),and(user1_id.eq.${opponentId},user2_id.eq.${userId})`;
      const { data, error } = await supabase
        .from('matchups')
        .select('user1_id,user2_id,user1_score,user2_score,winner_id,updated_at')
        .eq('status', 'completed')
        .or(pairFilter)
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const rows = (data || []) as MatchupRow[];
      let wins = 0;
      let losses = 0;
      let ties = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;
      let biggestWin = 0;
      let closestGame: number | null = null;
      let streakType: RivalryStats['streakType'] = null;
      let streakCount = 0;

      rows.forEach((row, index) => {
        const userIs1 = row.user1_id === userId;
        const mine = Number(userIs1 ? row.user1_score : row.user2_score);
        const theirs = Number(userIs1 ? row.user2_score : row.user1_score);
        pointsFor += mine;
        pointsAgainst += theirs;
        const margin = Math.abs(mine - theirs);
        closestGame = closestGame === null ? margin : Math.min(closestGame, margin);
        if (row.winner_id === null) ties += 1;
        else if (row.winner_id === userId) { wins += 1; biggestWin = Math.max(biggestWin, mine - theirs); }
        else losses += 1;

        if (index === 0) {
          streakType = row.winner_id === null ? 'T' : row.winner_id === userId ? 'W' : 'L';
          streakCount = 1;
        } else if (streakType === (row.winner_id === null ? 'T' : row.winner_id === userId ? 'W' : 'L')) {
          streakCount += 1;
        }
      });

      return { games: rows.length, wins, losses, ties, pointsFor, pointsAgainst, biggestWin, closestGame, streakType, streakCount };
    },
  });
}
