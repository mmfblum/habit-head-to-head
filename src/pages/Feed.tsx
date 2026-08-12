import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, TrendingUp, Activity, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { Skeleton } from '@/components/ui/skeleton';

interface FeedEntry {
  id: string;
  kind: 'score' | 'taunt' | 'league';
  title: string;
  body: string | null;
  created_at: string;
  avatar_url: string | null;
  points?: number;
}

type LeagueEventRow = {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  created_at: string;
  profiles?: {
    avatar_url?: string | null;
  } | null;
};

type ScoringFeedRow = {
  id: string;
  points_awarded: number;
  created_at: string;
  profiles?: {
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  task_instances?: {
    league_task_configs?: {
      task_templates?: {
        name?: string | null;
      } | null;
    } | null;
  } | null;
};

export default function Feed() {
  const queryClient = useQueryClient();
  const { data: league } = useUserPrimaryLeague();
  const leagueId = league?.id;
  const queryKey = ['league-events', leagueId];

  const { data: entries = [], isLoading } = useQuery({
    queryKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<FeedEntry[]> => {
      if (!leagueId) return [];

      const [eventsResult, scoresResult] = await Promise.all([
        supabase
          .from('league_events')
          .select(`
            id,
            event_type,
            title,
            body,
            created_at,
            actor_user_id,
            profiles!league_events_actor_user_id_fkey (
              display_name,
              avatar_url
            )
          `)
          .eq('league_id', leagueId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('scoring_events')
          .select(`
            id,
            user_id,
            points_awarded,
            created_at,
            task_instances!scoring_events_task_instance_id_fkey (
              league_task_configs (
                task_templates (
                  name,
                  icon
                )
              )
            ),
            profiles!scoring_events_user_id_fkey (
              display_name,
              avatar_url
            )
          `)
          .eq('league_id', leagueId)
          .eq('is_reversed', false)
          .order('created_at', { ascending: false })
          .limit(75),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (scoresResult.error) throw scoresResult.error;

      const leagueRows = (eventsResult.data || []) as unknown as LeagueEventRow[];
      const scoreRows = (scoresResult.data || []) as unknown as ScoringFeedRow[];

      const leagueEntries: FeedEntry[] = leagueRows.map((event) => ({
        id: `event-${event.id}`,
        kind: event.event_type === 'taunt' ? 'taunt' : 'league',
        title: event.title,
        body: event.body,
        created_at: event.created_at,
        avatar_url: event.profiles?.avatar_url || null,
      }));

      const scoringEntries: FeedEntry[] = scoreRows.map((event) => {
        const profile = event.profiles;
        const template = event.task_instances?.league_task_configs?.task_templates;
        return {
          id: `score-${event.id}`,
          kind: 'score',
          title: `${profile?.display_name || 'Player'} scored on ${template?.name || 'a task'}`,
          body: null,
          created_at: event.created_at,
          avatar_url: profile?.avatar_url || null,
          points: Number(event.points_awarded),
        };
      });

      return [...leagueEntries, ...scoringEntries]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 100);
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!leagueId) return;

    const channel = supabase
      .channel(`league-feed-${leagueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_events', filter: `league_id=eq.${leagueId}` },
        () => queryClient.invalidateQueries({ queryKey })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scoring_events', filter: `league_id=eq.${leagueId}` },
        () => queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, queryClient]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">{league?.name || 'Your league'}</p>
          <h1 className="font-display font-bold text-xl">League Feed</h1>
        </div>
      </header>

      <main className="px-4 py-4">
        <div className="mb-4">
          <p className="text-sm font-semibold">Live ticker</p>
          <p className="text-xs text-muted-foreground">Scoring plays and rivalry chatter from around the league.</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="card-elevated rounded-xl py-12 text-center text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Quiet league so far</p>
            <p className="text-xs mt-1">The first score or taunt will show up here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => {
              const isTaunt = entry.kind === 'taunt';
              const isScore = entry.kind === 'score';
              const initials = entry.title.charAt(0).toUpperCase();

              return (
                <div
                  key={entry.id}
                  className={`p-3 rounded-xl border flex items-center gap-3 ${
                    isTaunt ? 'bg-secondary/10 border-secondary/20' : isScore ? 'bg-primary/5 border-primary/15' : 'bg-card border-border'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${
                    isTaunt ? 'bg-secondary/20' : isScore ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    {entry.avatar_url ? (
                      <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : isTaunt ? (
                      <MessageCircle className="w-5 h-5 text-secondary" />
                    ) : isScore ? (
                      <TrendingUp className="w-5 h-5 text-primary" />
                    ) : (
                      <span className="font-semibold text-sm">{initials}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-tight">{entry.title}</p>
                      {isScore && entry.points !== undefined && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${
                          entry.points >= 0 ? 'bg-primary/20 text-primary' : 'bg-loss/20 text-loss'
                        }`}>
                          {entry.points >= 0 ? '+' : ''}{entry.points}
                        </span>
                      )}
                    </div>
                    {entry.body && <p className="text-sm mt-1">“{entry.body}”</p>}
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
