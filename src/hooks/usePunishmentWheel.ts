import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PunishmentSpin {
  id: string;
  league_id: string;
  week_id: string;
  matchup_id: string | null;
  loser_user_id: string;
  winner_user_id: string | null;
  punishment_option_id: string | null;
  result_label: string;
  result_description: string;
  result_emoji: string;
  spun_at: string;
  completed_at: string | null;
}

export function usePunishmentWheel(matchupId?: string, weekId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['punishment-spin', matchupId ?? weekId, user?.id];

  const spinQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<PunishmentSpin | null> => {
      if (!user?.id || (!matchupId && !weekId)) return null;
      let query = supabase
        .from('punishment_spins' as never)
        .select('*')
        .eq('loser_user_id', user.id);
      query = matchupId
        ? query.eq('matchup_id', matchupId)
        : query.eq('week_id', weekId!);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as unknown as PunishmentSpin | null;
    },
    enabled: !!user?.id && (!!matchupId || !!weekId),
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
      await queryClient.invalidateQueries({ queryKey });
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
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['league-events'] });
    },
  });

  return { ...spinQuery, spin, complete };
}
