import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PunishmentSpin {
  id: string;
  league_id: string;
  week_id: string;
  matchup_id: string;
  loser_user_id: string;
  winner_user_id: string;
  punishment_option_id: string | null;
  result_label: string;
  result_description: string;
  result_emoji: string;
  spun_at: string;
  completed_at: string | null;
}

export function usePunishmentWheel(matchupId?: string, weekId?: string) {
  const queryClient = useQueryClient();

  const spinQuery = useQuery({
    queryKey: ['punishment-spin', matchupId],
    queryFn: async (): Promise<PunishmentSpin | null> => {
      if (!matchupId) return null;
      const { data, error } = await supabase
        .from('punishment_spins' as never)
        .select('*')
        .eq('matchup_id', matchupId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PunishmentSpin | null;
    },
    enabled: !!matchupId,
  });

  const spin = useMutation({
    mutationFn: async (): Promise<PunishmentSpin> => {
      if (!weekId) throw new Error('Week not found');
      const { data, error } = await supabase.rpc(
        'spin_weekly_punishment' as never,
        { _week_id: weekId } as never
      );
      if (error) throw error;
      return data as unknown as PunishmentSpin;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['punishment-spin', matchupId] });
      await queryClient.invalidateQueries({ queryKey: ['league-events'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const complete = useMutation({
    mutationFn: async (spinId: string) => {
      const { error } = await supabase.rpc(
        'complete_weekly_punishment' as never,
        { _spin_id: spinId } as never
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['punishment-spin', matchupId] });
      await queryClient.invalidateQueries({ queryKey: ['league-events'] });
    },
  });

  return { ...spinQuery, spin, complete };
}
