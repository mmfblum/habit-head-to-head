import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AccountabilityTaskSnapshot {
  name: string;
  icon: string;
  goal: string | null;
  status: 'pending' | 'hit' | 'missed' | 'logged';
  points_today: number;
}

export interface AccountabilitySnapshot {
  display_name: string;
  avatar: string | null;
  league_name: string;
  format: 'solo' | 'head_to_head' | 'leaderboard';
  date: string;
  season_number: number | null;
  week_number: number | null;
  week_points: number;
  perfect_days: number;
  tasks_total: number;
  tasks_hit: number;
  tasks_resolved: number;
  tasks: AccountabilityTaskSnapshot[];
  generated_at: string;
}

interface ShareRow {
  id: string;
  token: string;
  is_active: boolean;
}

export function useAccountabilityShare(leagueId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['accountability-share', leagueId];

  const shareQuery = useQuery({
    queryKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<ShareRow | null> => {
      if (!leagueId) return null;
      const { data, error } = await supabase
        .from('accountability_shares' as never)
        .select('id,token,is_active')
        .eq('league_id', leagueId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ShareRow | null;
    },
  });

  const create = useMutation({
    mutationFn: async (): Promise<string> => {
      if (!leagueId) throw new Error('League not found');
      const { data, error } = await supabase.rpc(
        'create_accountability_share' as never,
        { _league_id: leagueId } as never
      );
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const revoke = useMutation({
    mutationFn: async () => {
      if (!leagueId) throw new Error('League not found');
      const { error } = await supabase.rpc(
        'revoke_accountability_share' as never,
        { _league_id: leagueId } as never
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...shareQuery, create, revoke };
}

export function usePublicAccountabilitySnapshot(token?: string) {
  return useQuery({
    queryKey: ['public-accountability', token],
    enabled: !!token,
    queryFn: async (): Promise<AccountabilitySnapshot | null> => {
      if (!token) return null;
      const { data, error } = await supabase.rpc(
        'get_public_accountability_snapshot' as never,
        { _token: token } as never
      );
      if (error) throw error;
      return data as unknown as AccountabilitySnapshot | null;
    },
    refetchInterval: 60_000,
  });
}
