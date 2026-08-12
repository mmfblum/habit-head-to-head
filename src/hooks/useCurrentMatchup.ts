import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type CurrentMatchup = Tables<'matchups'>;

/**
 * Returns the authenticated user's scheduled matchup for a specific week.
 *
 * The app previously inferred an opponent by picking the first other league
 * member, which breaks as soon as a league has more than two people. The
 * matchups table is the source of truth for weekly head-to-head pairings.
 */
export function useCurrentMatchup(weekId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['current-matchup', weekId, user?.id],
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
    staleTime: 15_000,
  });
}
