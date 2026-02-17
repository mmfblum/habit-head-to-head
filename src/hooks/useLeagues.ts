import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getLocalISODate } from '@/lib/date';
import { useAuth } from './useAuth';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type League = Tables<'leagues'>;
export type LeagueMember = Tables<'league_members'>;
export type Season = Tables<'seasons'>;

export function useUserLeagues() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-leagues', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('league_members')
        .select(`
          *,
          leagues (*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateLeague() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error('Must be logged in');

      // Create the league
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({ name, description, created_by: user.id })
        .select()
        .single();

      if (leagueError) throw leagueError;

      // Add user as owner
      const { error: memberError } = await supabase
        .from('league_members')
        .insert({
          league_id: league.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      return league;
    },
    onSuccess: async () => {
      // Invalidate both the exact key and base key to ensure LeagueGate updates
      await queryClient.invalidateQueries({ queryKey: ['user-leagues'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['user-leagues'] });
    },
  });
}

export function useCreateSeason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leagueId,
      name,
      weeksCount,
      startDate,
    }: {
      leagueId: string;
      name: string;
      weeksCount: number;
      startDate: Date;
    }) => {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + weeksCount * 7);

      // Get the next season number
      const { data: existingSeasons } = await supabase
        .from('seasons')
        .select('season_number')
        .eq('league_id', leagueId)
        .order('season_number', { ascending: false })
        .limit(1);

      const seasonNumber = (existingSeasons?.[0]?.season_number ?? 0) + 1;

      const { data: season, error } = await supabase
        .from('seasons')
        .insert({
          league_id: leagueId,
          name,
          season_number: seasonNumber,
          weeks_count: weeksCount,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;
      return season;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-leagues'] });
    },
  });
}

export function useConfigureSeasonTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      seasonId,
      taskConfigs,
    }: {
      seasonId: string;
      taskConfigs: Array<{
        task_template_id: string;
        config_overrides?: Record<string, string | number | boolean | null>;
        max_daily_points?: number;
        display_order: number;
      }>;
    }) => {
      const configsToInsert = taskConfigs.map((config) => ({
        season_id: seasonId,
        task_template_id: config.task_template_id,
        config_overrides: config.config_overrides || {},
        max_daily_points: config.max_daily_points || 100,
        display_order: config.display_order,
        is_enabled: true,
      }));

      const { data, error } = await supabase
        .from('league_task_configs')
        .insert(configsToInsert)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-task-configs'] });
    },
  });
}

export function useJoinLeague() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user) throw new Error('Must be logged in');

      // Check if user is already in a league (single-league enforcement)
      const { data: existingMembership } = await supabase
        .from('league_members')
        .select('id, leagues(name)')
        .eq('user_id', user.id)
        .single();

      if (existingMembership) {
        throw new Error('You are already in a league. Leave your current league first to join another.');
      }

      // Find league by invite code
      const { data: leagues, error: findError } = await supabase
        .from('leagues')
        .select('*')
        .eq('invite_code', inviteCode.toLowerCase().trim());

      if (findError) throw findError;
      if (!leagues || leagues.length === 0) throw new Error('Invalid invite code');

      const league = leagues[0];

      // Check member count
      const { count } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', league.id);

      if (count && count >= league.max_members) {
        throw new Error('This league is full');
      }

      // Join the league
      const { error: joinError } = await supabase
        .from('league_members')
        .insert({
          league_id: league.id,
          user_id: user.id,
          role: 'member',
        });

      if (joinError) {
        // Handle unique constraint violation
        if (joinError.code === '23505') {
          throw new Error('You are already in a league');
        }
        throw joinError;
      }

      return league;
    },
    onSuccess: async () => {
      // Invalidate and refetch to ensure LeagueGate updates immediately
      await queryClient.invalidateQueries({ queryKey: ['user-leagues'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['user-leagues'] });
    },
  });
}
