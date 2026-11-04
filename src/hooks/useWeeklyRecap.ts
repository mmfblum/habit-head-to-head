import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyRecap {
  week_id: string;
  week_number: number;
  format: 'head_to_head' | 'leaderboard' | 'solo';
  points: number;
  tasks_completed: number;
  perfect_days: number;
  top_task: string | null;
  top_task_points: number;
  power_play_used: boolean;
  result: 'W' | 'L' | 'T' | 'BYE' | 'RANK' | 'SOLO';
  opponent_name: string | null;
  user_score: number | null;
  opponent_score: number | null;
  weekly_rank: number | null;
  member_count: number | null;
  punishment_label: string | null;
  punishment_emoji: string | null;
  punishment_completed: boolean;
}

export function useWeeklyRecap(seasonId?: string) {
  return useQuery({
    queryKey: ['weekly-recap', seasonId],
    enabled: !!seasonId,
    queryFn: async (): Promise<WeeklyRecap | null> => {
      if (!seasonId) return null;
      const { data: weeks, error: weeksError } = await supabase
        .from('weeks')
        .select('id,week_number')
        .eq('season_id', seasonId)
        .eq('is_locked', true)
        .gt('week_number', 0)
        .order('week_number', { ascending: false })
        .limit(1);
      if (weeksError) throw weeksError;
      const week = weeks?.[0];
      if (!week) return null;

      const { data, error } = await supabase.rpc(
        'get_my_weekly_recap' as never,
        { _week_id: week.id } as never
      );
      if (error) throw error;
      return data as unknown as WeeklyRecap | null;
    },
    staleTime: 60_000,
  });
}
