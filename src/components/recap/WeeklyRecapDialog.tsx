import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Share2, Sparkles, Trophy, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWeeklyRecap } from '@/hooks/useWeeklyRecap';
import { shareZrizinLink } from '@/lib/nativeShare';
import { toast } from 'sonner';

interface WeeklyRecapDialogProps {
  seasonId?: string;
}

export function WeeklyRecapDialog({ seasonId }: WeeklyRecapDialogProps) {
  const { data: recap } = useWeeklyRecap(seasonId);
  const [open, setOpen] = useState(false);

  const storageKey = recap ? `zrizin-recap-seen:${recap.week_id}` : null;

  useEffect(() => {
    if (!recap || !storageKey) return;
    if (window.localStorage.getItem(storageKey) !== '1') setOpen(true);
  }, [recap, storageKey]);

  const headline = useMemo(() => {
    if (!recap) return '';
    if (recap.format === 'head_to_head') {
      if (recap.result === 'W') return 'Week won.';
      if (recap.result === 'L') return 'Week lost. Remember it.';
      if (recap.result === 'T') return 'Dead even.';
      return 'Bye week complete.';
    }
    if (recap.format === 'leaderboard') {
      return recap.weekly_rank === 1 ? 'You won the week.' : `You finished #${recap.weekly_rank ?? '—'}.`;
    }
    return 'Commitment week complete.';
  }, [recap]);

  const close = () => {
    if (storageKey) window.localStorage.setItem(storageKey, '1');
    setOpen(false);
  };

  const handleShare = async () => {
    if (!recap) return;
    const resultLine = recap.format === 'head_to_head'
      ? recap.result === 'BYE'
        ? `Week ${recap.week_number}: bye week, ${recap.points} pts.`
        : `Week ${recap.week_number}: ${recap.result} ${recap.user_score ?? 0}-${recap.opponent_score ?? 0} vs ${recap.opponent_name ?? 'opponent'}.`
      : recap.format === 'leaderboard'
        ? `Week ${recap.week_number}: #${recap.weekly_rank ?? '—'} of ${recap.member_count ?? '—'} with ${recap.points} pts.`
        : `Week ${recap.week_number}: ${recap.points} pts, ${recap.perfect_days} perfect day${recap.perfect_days === 1 ? '' : 's'}.`;

    try {
      const result = await shareZrizinLink({
        title: `Zrizin Week ${recap.week_number} Recap`,
        text: `${resultLine}${recap.top_task ? ` Top task: ${recap.top_task} (+${recap.top_task_points}).` : ''}`,
        url: window.location.origin,
      });
      if (result === 'copied') toast.success('Recap link copied');
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') toast.error('Could not share recap');
    }
  };

  if (!recap) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close(); else setOpen(true); }}>
      <DialogContent className="max-w-sm rounded-2xl overflow-hidden">
        <DialogHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto text-3xl">
            {recap.format === 'head_to_head'
              ? recap.result === 'W' ? '🏆' : recap.result === 'L' ? '💀' : recap.result === 'T' ? '🤝' : '🛡️'
              : recap.format === 'leaderboard' ? recap.weekly_rank === 1 ? '👑' : '🏁' : '🎯'}
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold mt-3">Week {recap.week_number} Recap</p>
          <DialogTitle className="font-display text-2xl">{headline}</DialogTitle>
          <DialogDescription>
            {recap.format === 'head_to_head' && recap.result !== 'BYE'
              ? `${recap.user_score ?? 0}-${recap.opponent_score ?? 0} vs ${recap.opponent_name ?? 'Opponent'}`
              : recap.format === 'leaderboard'
                ? `${recap.points} raw points · #${recap.weekly_rank ?? '—'} of ${recap.member_count ?? '—'}`
                : `${recap.points} points · ${recap.perfect_days} perfect day${recap.perfect_days === 1 ? '' : 's'}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-muted/45 p-3">
            <Trophy className="w-4 h-4 text-pending" />
            <p className="font-display font-bold text-xl mt-2">{recap.points}</p>
            <p className="text-[10px] text-muted-foreground">week points</p>
          </div>
          <div className="rounded-xl bg-muted/45 p-3">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <p className="font-display font-bold text-xl mt-2">{recap.perfect_days}</p>
            <p className="text-[10px] text-muted-foreground">perfect days</p>
          </div>
        </div>

        {recap.top_task && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><Award className="w-5 h-5 text-primary" /></div>
            <div className="flex-1"><p className="text-[10px] uppercase text-muted-foreground font-bold">MVP task</p><p className="font-semibold text-sm">{recap.top_task}</p></div>
            <span className="font-display font-bold text-primary">+{recap.top_task_points}</span>
          </div>
        )}

        {recap.power_play_used && (
          <div className="rounded-xl border border-secondary/20 bg-secondary/10 p-3 flex items-center gap-2 text-sm font-semibold">
            <Zap className="w-4 h-4 text-secondary fill-secondary" /> Power Play landed this week
          </div>
        )}

        {recap.punishment_label && (
          <div className="rounded-xl border border-loss/20 bg-loss/5 p-3 flex items-center gap-3">
            <span className="text-2xl">{recap.punishment_emoji || '💀'}</span>
            <div className="flex-1"><p className="text-[10px] uppercase text-loss font-bold">Consequence</p><p className="text-sm font-semibold">{recap.punishment_label}</p></div>
            {recap.punishment_completed && <Sparkles className="w-4 h-4 text-primary" />}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-1">
          <Button variant="outline" onClick={handleShare} className="gap-2"><Share2 className="w-4 h-4" />Share recap</Button>
          <Button onClick={close}>On to Week {recap.week_number + 1}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
