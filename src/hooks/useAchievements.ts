import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
}

export function useAchievements(userId?: string, seasonId?: string, wins = 0, currentStreak = 0, streakType?: string | null) {
  return useQuery({
    queryKey: ['achievements', userId, seasonId, wins, currentStreak, streakType],
    enabled: !!userId,
    queryFn: async (): Promise<Achievement[]> => {
      if (!userId) return [];

      const [scoresResult, powerResult, punishmentResult] = await Promise.all([
        supabase
          .from('weekly_scores')
          .select('total_points,perfect_days,weeks!inner(season_id)')
          .eq('user_id', userId),
        supabase
          .from('powerups')
          .select('id')
          .eq('user_id', userId)
          .eq('is_used', true)
          .limit(1),
        supabase
          .from('punishment_spins' as never)
          .select('id')
          .eq('loser_user_id', userId)
          .not('completed_at', 'is', null)
          .limit(1),
      ]);

      if (scoresResult.error) throw scoresResult.error;
      if (powerResult.error) throw powerResult.error;
      if (punishmentResult.error) throw punishmentResult.error;

      const allScores = scoresResult.data || [];
      const seasonScores = seasonId
        ? allScores.filter((score) => {
            const relation = score.weeks as unknown as { season_id?: string } | null;
            return relation?.season_id === seasonId;
          })
        : allScores;
      const hasPerfectDay = seasonScores.some((score) => Number(score.perfect_days) > 0);
      const hasCenturyWeek = seasonScores.some((score) => Number(score.total_points) >= 100);
      const usedPowerPlay = (powerResult.data || []).length > 0;
      const servedPunishment = ((punishmentResult.data || []) as unknown[]).length > 0;

      return [
        { id: 'first_win', emoji: '🏆', name: 'First Blood', description: 'Win your first Head-to-Head matchup.', earned: wins > 0 },
        { id: 'hot_streak', emoji: '🔥', name: 'On Fire', description: 'Win 3 matchups in a row.', earned: streakType === 'W' && currentStreak >= 3 },
        { id: 'perfect_day', emoji: '💯', name: 'Perfect Day', description: 'Clear every scoring chance in a day.', earned: hasPerfectDay },
        { id: 'power_player', emoji: '⚡', name: 'Power Player', description: 'Land a weekly 2× Power Play.', earned: usedPowerPlay },
        { id: 'century_week', emoji: '💪', name: 'Century Club', description: 'Score 100+ points in an official week.', earned: hasCenturyWeek },
        { id: 'served', emoji: '🫡', name: 'Punishment Served', description: 'Lose, spin, and actually complete the punishment.', earned: servedPunishment },
      ];
    },
  });
}
