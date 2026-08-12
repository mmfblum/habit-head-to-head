import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Tables } from '@/integrations/supabase/types';

export type League = Tables<'leagues'>;
export type LeagueMember = Tables<'league_members'>;
export type Season = Tables<'seasons'>;
export type LeagueGameFormat = 'head_to_head' | 'leaderboard';

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
    mutationFn: async ({
      name,
      description,
      gameFormat = 'head_to_head',
    }: {
      name: string;
      description?: string;
      gameFormat?: LeagueGameFormat;
    }) => {
      if (!user) throw new Error('Must be logged in');

      const { data: leagueId, error: createError } = await supabase.rpc(
        'create_league' as never,
        {
          _name: name,
          _description: description ?? null,
          _game_format: gameFormat,
        } as never
      );

      if (createError) throw createError;
      if (!leagueId) throw new Error('League creation did not return a league ID');

      const { data: league, error: fetchError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId as unknown as string)
        .single();

      if (fetchError) throw fetchError;
      return league as typeof league & { game_format: LeagueGameFormat };
    },
    onSuccess: async () => {
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

      const { data: leagueId, error } = await supabase.rpc(
        'join_league_by_code' as never,
        { _invite_code: inviteCode.trim() } as never
      );

      if (error) throw error;
      if (!leagueId) throw new Error('League join did not return a league ID');

      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId as unknown as string)
        .single();
      if (leagueError) throw leagueError;
      return league;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user-leagues'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['user-league-memberships'] });
      await queryClient.invalidateQueries({ queryKey: ['league-details'] });
      await queryClient.refetchQueries({ queryKey: ['user-leagues'] });
    },
  });
}