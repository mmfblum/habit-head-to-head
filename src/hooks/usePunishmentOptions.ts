import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PunishmentOption {
  id: string;
  league_id: string | null;
  label: string;
  description: string;
  emoji: string;
  is_active: boolean;
}

export function usePunishmentOptions(leagueId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['punishment-options', leagueId];

  const optionsQuery = useQuery({
    queryKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<PunishmentOption[]> => {
      if (!leagueId) return [];
      const { data, error } = await supabase
        .from('punishment_options' as never)
        .select('id,league_id,label,description,emoji,is_active')
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as unknown as PunishmentOption[];
    },
  });

  const add = useMutation({
    mutationFn: async ({ label, description, emoji }: { label: string; description: string; emoji: string }) => {
      if (!leagueId) throw new Error('League not found');
      const { data, error } = await supabase.rpc(
        'add_league_punishment' as never,
        { _league_id: leagueId, _label: label, _description: description, _emoji: emoji } as never
      );
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (punishmentId: string) => {
      const { error } = await supabase.rpc(
        'remove_league_punishment' as never,
        { _punishment_id: punishmentId } as never
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...optionsQuery, add, remove };
}
