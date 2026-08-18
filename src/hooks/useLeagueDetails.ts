import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getLocalISODate } from '@/lib/date';
import { useAuth } from './useAuth';
import type { LeagueGameFormat } from './useLeagues';

export interface LeagueMemberWithProfile {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
  championship_points: number;
  wins: number;
  losses: number;
  ties: number;
  current_streak: number;
  streak_type: string | null;
  current_rank: number | null;
  weekly_points: number;
}

export interface LeagueDetails {
  id: string;
  name: string;
  description: string | null;
  invite_code: string | null;
  max_members: number;
  min_members: number;
  created_by: string | null;
  game_format: LeagueGameFormat;
  current_season: {
    id: string;
    name: string;
    season_number: number;
    status: string;
    start_date: string;
    end_date: string;
    weeks_count: number;
  } | null;
  current_week: {
    id: string;
    week_number: number;
    start_date: string;
    end_date: string;
    is_locked: boolean;
  } | null;
  members: LeagueMemberWithProfile[];
}

export function useLeagueDetails(leagueId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['league-details', leagueId],
    queryFn: async (): Promise<LeagueDetails | null> => {
      if (!leagueId) return null;

      const { error: lifecycleError } = await supabase.rpc(
        'refresh_competition_state' as never,
        { _league_id: leagueId } as never
      );
      if (lifecycleError) throw lifecycleError;

      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single();
      if (leagueError) throw leagueError;
      if (!league) return null;

      const leagueRecord = league as typeof league & { game_format?: LeagueGameFormat };
      const gameFormat: LeagueGameFormat = leagueRecord.game_format ?? 'head_to_head';

      const { data: seasons, error: seasonsError } = await supabase
        .from('seasons')
        .select('*')
        .eq('league_id', leagueId)
        .in('status', ['active', 'draft'])
        .order('season_number', { ascending: false })
        .limit(1);
      if (seasonsError) throw seasonsError;
      const currentSeason = seasons?.[0] || null;

      let currentWeek = null;
      if (currentSeason) {
        const today = getLocalISODate();
        const { data: weeks, error: weeksError } = await supabase
          .from('weeks')
          .select('*')
          .eq('season_id', currentSeason.id)
          .lte('start_date', today)
          .gte('end_date', today)
          .limit(1);
        if (weeksError) throw weeksError;
        currentWeek = weeks?.[0] || null;

        if (!currentWeek) {
          const { data: upcomingWeeks, error: upcomingError } = await supabase
            .from('weeks')
            .select('*')
            .eq('season_id', currentSeason.id)
            .gt('start_date', today)
            .order('week_number', { ascending: true })
            .limit(1);
          if (upcomingError) throw upcomingError;
          currentWeek = upcomingWeeks?.[0] || null;

          if (!currentWeek) {
            const { data: latestWeek, error: latestError } = await supabase
              .from('weeks')
              .select('*')
              .eq('season_id', currentSeason.id)
              .lt('end_date', today)
              .order('week_number', { ascending: false })
              .limit(1);
            if (latestError) throw latestError;
            currentWeek = latestWeek?.[0] || null;
          }
        }
      }

      const { data: members, error: membersError } = await supabase
        .from('league_members')
        .select(`id,user_id,role,profiles(display_name,avatar_url)`)
        .eq('league_id', leagueId);
      if (membersError) throw membersError;

      const standingsMap = new Map<string, {
        total_points: number;
        championship_points: number;
        wins: number;
        losses: number;
        ties: number;
        current_streak: number;
        streak_type: string | null;
        current_rank: number | null;
      }>();

      if (currentSeason) {
        const { data: standings, error: standingsError } = await supabase
          .from('season_standings')
          .select('*')
          .eq('season_id', currentSeason.id);
        if (standingsError) throw standingsError;
        standings?.forEach((standing) => {
          const extended = standing as typeof standing & { championship_points?: number };
          standingsMap.set(standing.user_id, {
            total_points: Number(standing.total_points),
            championship_points: Number(extended.championship_points ?? 0),
            wins: standing.wins,
            losses: standing.losses,
            ties: standing.ties,
            current_streak: standing.current_streak,
            streak_type: standing.streak_type,
            current_rank: standing.current_rank,
          });
        });
      }

      const weeklyScoresMap = new Map<string, number>();
      if (currentWeek) {
        const { data: weeklyScores, error: scoresError } = await supabase
          .from('weekly_scores')
          .select('user_id, total_points')
          .eq('week_id', currentWeek.id);
        if (scoresError) throw scoresError;
        weeklyScores?.forEach((weeklyScore) => weeklyScoresMap.set(weeklyScore.user_id, Number(weeklyScore.total_points)));
      }

      const membersWithDetails: LeagueMemberWithProfile[] = (members || []).map((member) => {
        const profile = member.profiles as { display_name: string | null; avatar_url: string | null } | null;
        const standing = standingsMap.get(member.user_id);
        return {
          id: member.id,
          user_id: member.user_id,
          role: member.role,
          display_name: profile?.display_name || 'Unknown',
          avatar_url: profile?.avatar_url || null,
          total_points: standing?.total_points || 0,
          championship_points: standing?.championship_points || 0,
          wins: standing?.wins || 0,
          losses: standing?.losses || 0,
          ties: standing?.ties || 0,
          current_streak: standing?.current_streak || 0,
          streak_type: standing?.streak_type || null,
          current_rank: standing?.current_rank || null,
          weekly_points: weeklyScoresMap.get(member.user_id) || 0,
        };
      });

      if (gameFormat === 'leaderboard') {
        membersWithDetails.sort((a, b) =>
          b.championship_points - a.championship_points || b.total_points - a.total_points
        );
      } else {
        membersWithDetails.sort((a, b) =>
          b.wins - a.wins || b.ties - a.ties || b.total_points - a.total_points || a.losses - b.losses
        );
      }

      membersWithDetails.forEach((member, index) => {
        if (!member.current_rank) member.current_rank = index + 1;
      });

      return {
        id: league.id,
        name: league.name,
        description: league.description,
        invite_code: league.invite_code,
        max_members: league.max_members,
        min_members: league.min_members,
        created_by: league.created_by,
        game_format: gameFormat,
        current_season: currentSeason ? {
          id: currentSeason.id,
          name: currentSeason.name,
          season_number: currentSeason.season_number,
          status: currentSeason.status,
          start_date: currentSeason.start_date,
          end_date: currentSeason.end_date,
          weeks_count: currentSeason.weeks_count,
        } : null,
        current_week: currentWeek ? {
          id: currentWeek.id,
          week_number: currentWeek.week_number,
          start_date: currentWeek.start_date,
          end_date: currentWeek.end_date,
          is_locked: currentWeek.is_locked,
        } : null,
        members: membersWithDetails,
      };
    },
    enabled: !!user && !!leagueId,
    staleTime: 15_000,
  });
}

export interface UserLeagueMembership {
  league_id: string;
  leagues: {
    id: string;
    name: string;
    game_format?: LeagueGameFormat | null;
  } | null;
}

export function useUserPrimaryLeague() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const selectionKey = ['selected-league', user?.id] as const;

  const { data: selectedPreference } = useQuery({
    queryKey: selectionKey,
    queryFn: async () => {
      if (!user) return undefined;
      return localStorage.getItem(`zrizin:selected-league:${user.id}`) || undefined;
    },
    enabled: !!user,
    staleTime: Infinity,
  });

  const { data: memberships = [], isLoading: membershipsLoading } = useQuery({
    queryKey: ['user-league-memberships', user?.id],
    queryFn: async (): Promise<UserLeagueMembership[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('league_members')
        .select('league_id,joined_at,leagues(id,name,game_format)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UserLeagueMembership[];
    },
    enabled: !!user,
  });

  const preferredIsValid = !!selectedPreference
    && memberships.some((membership) => membership.league_id === selectedPreference);
  const selectedLeagueId = preferredIsValid
    ? selectedPreference
    : memberships[0]?.league_id;

  const leagueDetails = useLeagueDetails(selectedLeagueId);

  const selectLeague = (leagueId: string) => {
    if (!user?.id || !memberships.some((membership) => membership.league_id === leagueId)) return;
    localStorage.setItem(`zrizin:selected-league:${user.id}`, leagueId);
    queryClient.setQueryData(selectionKey, leagueId);
    queryClient.invalidateQueries({ queryKey: ['league-details'] });
    queryClient.invalidateQueries({ queryKey: ['current-matchup'] });
    queryClient.invalidateQueries({ queryKey: ['tasks-with-checkins'] });
  };

  return {
    ...leagueDetails,
    isLoading: membershipsLoading || leagueDetails.isLoading,
    leagueId: selectedLeagueId,
    memberships,
    selectLeague,
  };
}
