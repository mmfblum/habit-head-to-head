import { useParams } from 'react-router-dom';
import { Check, Clock3, Eye, Share2, X } from 'lucide-react';
import { usePublicAccountabilitySnapshot } from '@/hooks/useAccountabilityShare';
import { TASK_ICONS } from '@/types/checkin';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

function isImageUrl(value?: string | null) {
  return !!value && (value.startsWith('http://') || value.startsWith('https://'));
}

export default function Accountability() {
  const { token } = useParams<{ token: string }>();
  const { data: snapshot, isLoading, error } = usePublicAccountabilitySnapshot(token);

  const sharePage = async () => {
    const url = window.location.href;
    const text = snapshot
      ? `${snapshot.display_name} said these goals matter. See whether they are keeping them on Zrizin.`
      : 'Accountability progress on Zrizin';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Zrizin Accountability', text, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Accountability link copied');
      }
    } catch (shareError) {
      if ((shareError as Error)?.name !== 'AbortError') {
        await navigator.clipboard.writeText(url);
        toast.success('Accountability link copied');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto text-3xl">🔒</div>
          <h1 className="font-display font-bold text-2xl mt-4">This accountability link is closed</h1>
          <p className="text-sm text-muted-foreground mt-2">The owner may have revoked it or created a new share link.</p>
        </div>
      </div>
    );
  }

  const hitCount = snapshot.tasks.filter((task) => task.status === 'hit').length;
  const missedCount = snapshot.tasks.filter((task) => task.status === 'missed').length;
  const loggedCount = snapshot.tasks.filter((task) => task.status === 'logged').length;
  const pendingCount = snapshot.tasks.filter((task) => task.status === 'pending').length;
  const goalTasks = snapshot.tasks.filter((task) => task.status !== 'logged');
  const progress = goalTasks.length > 0 ? (hitCount / goalTasks.length) * 100 : 0;
  const avatar = snapshot.avatar || snapshot.display_name.charAt(0).toUpperCase() || '🎯';

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div><p className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Zrizin Accountability</p><p className="font-display font-bold">{snapshot.league_name}</p></div>
          <Button variant="outline" size="sm" onClick={sharePage} className="gap-2"><Share2 className="w-4 h-4" />Share</Button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-5">
        <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-card p-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-3xl overflow-hidden">
              {isImageUrl(avatar) ? <img src={avatar} alt={snapshot.display_name} className="w-full h-full object-cover" /> : <span>{avatar}</span>}
            </div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Public commitment</p>
              <h1 className="font-display font-bold text-xl">{snapshot.display_name}</h1>
              <p className="text-sm text-muted-foreground">Week {snapshot.week_number ?? 1} · {snapshot.date}</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm mb-2"><span className="font-semibold">Today’s goals</span><span>{hitCount}/{goalTasks.length} hit</span></div>
            <Progress value={progress} className="h-2.5" />
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="rounded-xl bg-background/70 p-2"><p className="font-display font-bold text-lg">{snapshot.week_points}</p><p className="text-[10px] text-muted-foreground">week points</p></div>
              <div className="rounded-xl bg-background/70 p-2"><p className="font-display font-bold text-lg">{snapshot.perfect_days}</p><p className="text-[10px] text-muted-foreground">perfect days</p></div>
              <div className="rounded-xl bg-background/70 p-2"><p className="font-display font-bold text-lg">{pendingCount}</p><p className="text-[10px] text-muted-foreground">still pending</p></div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3"><div><p className="font-display font-bold">The promises</p><p className="text-xs text-muted-foreground">Live status from today’s scorecard</p></div><Eye className="w-4 h-4 text-muted-foreground" /></div>
          <div className="space-y-2">
            {snapshot.tasks.map((task) => {
              const icon = TASK_ICONS[task.icon] ?? '🎯';
              const statusMeta = task.status === 'hit'
                ? { icon: Check, text: 'Hit', cls: 'text-primary bg-primary/10 border-primary/20' }
                : task.status === 'missed'
                  ? { icon: X, text: 'Missed', cls: 'text-loss bg-loss/10 border-loss/20' }
                  : task.status === 'logged'
                    ? { icon: Check, text: 'Logged', cls: 'text-secondary bg-secondary/10 border-secondary/20' }
                    : { icon: Clock3, text: 'Pending', cls: 'text-muted-foreground bg-muted/50 border-border' };
              const StatusIcon = statusMeta.icon;
              return (
                <div key={task.name} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">{icon}</div>
                  <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{task.name}</p><p className="text-xs text-muted-foreground truncate">{task.goal || 'Daily commitment'}</p></div>
                  <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 ${statusMeta.cls}`}><StatusIcon className="w-3 h-3" />{statusMeta.text}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl bg-muted/40 p-4 text-center">
          <p className="text-sm font-semibold">Accountability works better when somebody can see it.</p>
          <p className="text-xs text-muted-foreground mt-1">This page updates as {snapshot.display_name} scores the day. The owner can revoke this link at any time.</p>
          <p className="text-[10px] text-muted-foreground mt-3">{hitCount} hit · {missedCount} missed · {loggedCount} performance logs · {pendingCount} pending</p>
        </section>
      </main>
    </div>
  );
}
