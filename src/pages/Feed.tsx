import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Clock, MessageCircle, Send, TrendingUp, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface FeedEntry {
  id: string;
  kind: 'score' | 'taunt' | 'league';
  title: string;
  body: string | null;
  created_at: string;
  avatar_url: string | null;
  points?: number;
  powerPlay?: boolean;
}

type LeagueEventRow = { id: string; event_type: string; title: string; body: string | null; created_at: string; profiles?: { avatar_url?: string | null } | null };
type ScoringFeedRow = {
  id: string;
  points_awarded: number;
  powerup_applied?: unknown;
  created_at: string;
  profiles?: { display_name?: string | null; avatar_url?: string | null } | null;
  task_instances?: { league_task_configs?: { task_templates?: { name?: string | null } | null } | null } | null;
  daily_checkins?: { metadata?: Record<string, unknown> | null } | null;
};
type ReactionRow = { id: string; event_key: string; user_id: string; emoji: string };
type RawCommentRow = { id: string; event_key: string; user_id: string; body: string; created_at: string };
type CommentRow = RawCommentRow & { display_name: string; avatar_url: string | null };

const REACTIONS = ['🔥', '😂', '💀', '👏', '😤'] as const;
function isImageUrl(value: string | null): boolean { return !!value && (value.startsWith('http://') || value.startsWith('https://')); }

export default function Feed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: league } = useUserPrimaryLeague();
  const leagueId = league?.id;
  const queryKey = ['league-events', leagueId];
  const reactionKey = ['feed-reactions', leagueId];
  const commentKey = ['feed-comments', leagueId];
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: entries = [], isLoading } = useQuery({
    queryKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<FeedEntry[]> => {
      if (!leagueId) return [];
      const [eventsResult, scoresResult] = await Promise.all([
        supabase.from('league_events').select(`id,event_type,title,body,created_at,actor_user_id,profiles!league_events_actor_user_id_fkey(display_name,avatar_url)`).eq('league_id', leagueId).order('created_at', { ascending: false }).limit(60),
        supabase.from('scoring_events').select(`id,user_id,points_awarded,powerup_applied,created_at,daily_checkins!scoring_events_daily_checkin_id_fkey(metadata),task_instances!scoring_events_task_instance_id_fkey(league_task_configs(task_templates(name,icon))),profiles!scoring_events_user_id_fkey(display_name,avatar_url)`).eq('league_id', leagueId).eq('is_reversed', false).gt('points_awarded', 0).order('created_at', { ascending: false }).limit(80),
      ]);
      if (eventsResult.error) throw eventsResult.error;
      if (scoresResult.error) throw scoresResult.error;

      const leagueRows = (eventsResult.data || []) as unknown as LeagueEventRow[];
      const scoreRows = (scoresResult.data || []) as unknown as ScoringFeedRow[];
      const leagueEntries: FeedEntry[] = leagueRows.map((event) => ({ id: `event-${event.id}`, kind: event.event_type === 'taunt' ? 'taunt' : 'league', title: event.title, body: event.body, created_at: event.created_at, avatar_url: event.profiles?.avatar_url || null }));
      const scoringEntries: FeedEntry[] = scoreRows.map((event) => {
        const profile = event.profiles;
        const template = event.task_instances?.league_task_configs?.task_templates;
        const points = Number(event.points_awarded);
        const powerPlay = event.powerup_applied != null;
        const taskName = template?.name || 'a task';
        const readingNote = typeof event.daily_checkins?.metadata?.reading_note === 'string' ? event.daily_checkins.metadata.reading_note : null;
        return {
          id: `score-${event.id}`,
          kind: 'score',
          title: powerPlay ? `⚡ ${profile?.display_name || 'Player'} dropped a Power Play on ${taskName}` : points >= 5 ? `🔥 ${profile?.display_name || 'Player'} put up ${points} on ${taskName}` : `${profile?.display_name || 'Player'} scored ${taskName}`,
          body: readingNote ? `📖 ${readingNote}` : null,
          created_at: event.created_at,
          avatar_url: profile?.avatar_url || null,
          points,
          powerPlay,
        };
      });
      return [...leagueEntries, ...scoringEntries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100);
    },
    staleTime: 10_000,
  });

  const { data: reactions = [] } = useQuery({
    queryKey: reactionKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<ReactionRow[]> => {
      if (!leagueId) return [];
      const { data, error } = await supabase.from('feed_reactions' as never).select('id,event_key,user_id,emoji').eq('league_id', leagueId);
      if (error) throw error;
      return (data || []) as unknown as ReactionRow[];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: commentKey,
    enabled: !!leagueId,
    queryFn: async (): Promise<CommentRow[]> => {
      if (!leagueId) return [];
      const { data, error } = await supabase.from('feed_comments' as never).select('id,event_key,user_id,body,created_at').eq('league_id', leagueId).order('created_at', { ascending: true });
      if (error) throw error;
      const rows = (data || []) as unknown as RawCommentRow[];
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', userIds);
      if (profileError) throw profileError;
      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
      return rows.map((row) => ({ ...row, display_name: profileMap.get(row.user_id)?.display_name || 'Player', avatar_url: profileMap.get(row.user_id)?.avatar_url || null }));
    },
  });

  const reactToEntry = useMutation({
    mutationFn: async ({ eventKey, emoji }: { eventKey: string; emoji: string }) => {
      if (!leagueId || !user?.id) throw new Error('Sign in to react');
      const existing = reactions.find((reaction) => reaction.event_key === eventKey && reaction.user_id === user.id);
      if (existing?.emoji === emoji) {
        const { error } = await supabase.from('feed_reactions' as never).delete().eq('id', existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('feed_reactions' as never).upsert({ league_id: leagueId, event_key: eventKey, user_id: user.id, emoji } as never, { onConflict: 'event_key,user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reactionKey }),
  });

  const addComment = useMutation({
    mutationFn: async ({ eventKey, body }: { eventKey: string; body: string }) => {
      if (!leagueId || !user?.id) throw new Error('Sign in to comment');
      const clean = body.trim();
      if (!clean) return;
      const { error } = await supabase.from('feed_comments' as never).insert({ league_id: leagueId, event_key: eventKey, user_id: user.id, body: clean } as never);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      setDrafts((current) => ({ ...current, [variables.eventKey]: '' }));
      queryClient.invalidateQueries({ queryKey: commentKey });
    },
  });

  useEffect(() => {
    if (!leagueId) return;
    const channel = supabase.channel(`league-feed-${leagueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_events', filter: `league_id=eq.${leagueId}` }, () => queryClient.invalidateQueries({ queryKey }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scoring_events', filter: `league_id=eq.${leagueId}` }, () => queryClient.invalidateQueries({ queryKey }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_reactions', filter: `league_id=eq.${leagueId}` }, () => queryClient.invalidateQueries({ queryKey: reactionKey }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments', filter: `league_id=eq.${leagueId}` }, () => queryClient.invalidateQueries({ queryKey: commentKey }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [leagueId, queryClient]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top"><div className="px-4 py-3"><p className="text-xs text-muted-foreground">{league?.name || 'Your league'}</p><h1 className="font-display font-bold text-xl">League Feed</h1></div></header>
      <main className="px-4 py-4">
        <div className="mb-4"><p className="text-sm font-semibold">League moments</p><p className="text-xs text-muted-foreground">Scores, books, Power Plays, taunts, punishments and the moments worth talking about.</p></div>
        {isLoading ? <div className="space-y-3">{[1,2,3,4].map((item)=><Skeleton key={item} className="h-24 rounded-xl" />)}</div> : entries.length === 0 ? (
          <div className="card-elevated rounded-xl py-12 text-center text-muted-foreground"><Activity className="w-8 h-8 mx-auto mb-3 opacity-50" /><p className="text-sm font-medium">Quiet league so far</p><p className="text-xs mt-1">The first score or taunt will show up here.</p></div>
        ) : <div className="space-y-3">{entries.map((entry) => {
          const isTaunt=entry.kind==='taunt'; const isScore=entry.kind==='score'; const initials=entry.title.charAt(0).toUpperCase(); const entryReactions=reactions.filter((reaction)=>reaction.event_key===entry.id); const myReaction=entryReactions.find((reaction)=>reaction.user_id===user?.id)?.emoji; const entryComments=comments.filter((comment)=>comment.event_key===entry.id); const commentsOpen=expandedComments[entry.id] || entryComments.length>0; const draft=drafts[entry.id] || '';
          return <div key={entry.id} className={`p-3 rounded-xl border ${isTaunt?'bg-secondary/10 border-secondary/20':entry.powerPlay?'bg-secondary/5 border-secondary/25':isScore?'bg-primary/5 border-primary/15':'bg-card border-border'}`}>
            <div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${isTaunt?'bg-secondary/20':isScore?'bg-primary/20':'bg-muted'}`}>{entry.avatar_url ? isImageUrl(entry.avatar_url) ? <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl">{entry.avatar_url}</span> : isTaunt?<MessageCircle className="w-5 h-5 text-secondary"/>:entry.powerPlay?<Zap className="w-5 h-5 text-secondary"/>:isScore?<TrendingUp className="w-5 h-5 text-primary"/>:<span className="font-semibold text-sm">{initials}</span>}</div>
              <div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><p className="font-medium text-sm leading-tight">{entry.title}</p>{isScore&&entry.points!==undefined&&<span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary">+{entry.points}</span>}</div>{entry.body&&<p className="text-sm mt-1">{entry.body}</p>}<p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-2.5 h-2.5"/>{formatDistanceToNow(new Date(entry.created_at),{addSuffix:true})}</p></div></div>
            <div className="flex items-center gap-1 mt-3 pl-12 flex-wrap">{REACTIONS.map((emoji)=>{const count=entryReactions.filter((reaction)=>reaction.emoji===emoji).length;const selected=myReaction===emoji;return <button type="button" key={emoji} onClick={()=>reactToEntry.mutate({eventKey:entry.id,emoji})} className={`h-7 min-w-8 px-1.5 rounded-full border text-xs flex items-center justify-center gap-1 transition-colors ${selected?'bg-primary/15 border-primary/30':'bg-muted/40 border-border hover:bg-muted'}`}><span>{emoji}</span>{count>0&&<span className="text-[10px]">{count}</span>}</button>;})}<button type="button" onClick={()=>setExpandedComments((current)=>({...current,[entry.id]:!current[entry.id]}))} className="h-7 px-2 rounded-full border border-border bg-muted/40 text-[11px] flex items-center gap-1"><MessageCircle className="w-3 h-3"/>{entryComments.length || 'Comment'}</button></div>
            {commentsOpen && <div className="mt-3 ml-12 space-y-2"><div className="space-y-2">{entryComments.map((comment)=><div key={comment.id} className="rounded-xl bg-background/70 border border-border/60 px-3 py-2"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex items-center justify-center text-[10px]">{comment.avatar_url ? isImageUrl(comment.avatar_url)?<img src={comment.avatar_url} alt="" className="w-full h-full object-cover"/>:<span>{comment.avatar_url}</span>:comment.display_name.charAt(0)}</div><span className="text-[11px] font-semibold">{comment.display_name}</span><span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at),{addSuffix:true})}</span></div><p className="text-sm mt-1">{comment.body}</p></div>)}</div><div className="flex gap-2"><Input value={draft} onChange={(event)=>setDrafts((current)=>({...current,[entry.id]:event.target.value}))} placeholder="Talk trash or cheer them on…" maxLength={500} onKeyDown={(event)=>{if(event.key==='Enter'&&!event.shiftKey&&draft.trim()){event.preventDefault();addComment.mutate({eventKey:entry.id,body:draft});}}}/><Button type="button" size="icon" onClick={()=>addComment.mutate({eventKey:entry.id,body:draft})} disabled={!draft.trim()||addComment.isPending}><Send className="w-4 h-4"/></Button></div></div>}
          </div>;
        })}</div>}
      </main>
    </div>
  );
}
