import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserPrimaryLeague } from '@/hooks/useLeagueDetails';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Feed() {
  const { data: league } = useUserPrimaryLeague();
  const leagueId = league?.league.id;

  const { data, isLoading } = useQuery({
    queryKey: ['league-events', leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('league_events')
        .select('id,event_type,title,body,created_at,actor_user_id')
        .eq('league_id', leagueId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    }
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4">
        <h1 className="text-lg font-semibold">League Feed</h1>
        <p className="text-sm text-muted-foreground">Recent activity in your league.</p>
      </div>

      <div className="px-4 space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (data ?? []).length === 0 ? (
          <p className="text-muted-foreground">No activity yet.</p>
        ) : (
          data!.map((e: any) => (
            <Card key={e.id}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{e.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                {e.body && <p className="text-sm text-muted-foreground">{e.body}</p>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
