import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type CurrentMatchup = Tables<'matchups'>;

/** Returns the authenticated user's scheduled matchup for a specific week. */
export function useCurrentMatchup(weekId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['current-matchup', weekId, user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<CurrentMatchup | null> => {
      if (!weekId || !user?.id) return null;

      const { data, error } = await supabase
        .from('matchups')
        .select('*')
        .eq('week_id', weekId)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!weekId && !!user?.id,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!weekId || !user?.id) return;

    const channel = supabase
      .channel(`current-matchup-${weekId}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchups',
          filter: `week_id=eq.${weekId}`,
        },
        () => queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekId, user?.id, queryClient]);

  return query;
}

/** Returns every head-to-head game on the current league slate. */
export function useWeekMatchups(weekId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['week-matchups', weekId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<CurrentMatchup[]> => {
      if (!weekId) return [];

      const { data, error } = await supabase
        .from('matchups')
        .select('*')
        .eq('week_id', weekId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!weekId,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!weekId) return;

    const channel = supabase
      .channel(`week-matchups-${weekId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchups',
          filter: `week_id=eq.${weekId}`,
        },
        () => queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekId, queryClient]);

  return query;
}
