import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Skull, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePunishmentWheel, type PunishmentSpin } from '@/hooks/usePunishmentWheel';
import { toast } from 'sonner';

interface PunishmentWheelCardProps {
  matchupId?: string;
  weekId: string;
  didLose: boolean;
  opponentName?: string;
  context?: 'matchup' | 'leaderboard';
}

const WHEEL_EMOJIS = ['🫏', '💀', '🎙️', '👏', '🎭', '📚'];

export function PunishmentWheelCard({
  matchupId,
  weekId,
  didLose,
  opponentName = 'The loser',
  context = 'matchup',
}: PunishmentWheelCardProps) {
  const { data: savedSpin, spin, complete, isLoading } = usePunishmentWheel(matchupId, weekId);
  const [isSpinning, setIsSpinning] = useState(false);
  const [justSpun, setJustSpun] = useState<PunishmentSpin | null>(null);

  const result = justSpun ?? savedSpin;
  const loserTitle = context === 'leaderboard' ? 'You finished last. Spin the wheel.' : 'You lost. Spin the wheel.';
  const winnerTitle = context === 'leaderboard' ? 'You escaped last place.' : 'You won. No wheel for you.';
  const winnerBody = context === 'leaderboard'
    ? `${opponentName} finished last and still owes the league a punishment spin.`
    : `${opponentName} still owes the league a punishment spin.`;

  const handleSpin = async () => {
    setIsSpinning(true);
    try {
      const outcome = await spin.mutateAsync();
      window.setTimeout(() => {
        setJustSpun(outcome);
        setIsSpinning(false);
      }, 1600);
    } catch (error) {
      setIsSpinning(false);
      toast.error(error instanceof Error ? error.message : 'Could not spin the wheel');
    }
  };

  const handleComplete = async () => {
    if (!result) return;
    try {
      await complete.mutateAsync(result.id);
      setJustSpun({ ...result, completed_at: new Date().toISOString() });
      toast.success('Punishment served. Respect.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update punishment');
    }
  };

  if (isLoading) return null;

  if (isSpinning) {
    return (
      <section className="rounded-2xl border border-loss/25 bg-loss/5 p-5 text-center overflow-hidden">
        <p className="text-[10px] uppercase tracking-[0.2em] text-loss font-bold">The wheel decides</p>
        <div className="relative w-40 h-40 mx-auto my-5">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 text-2xl">▼</div>
          <motion.div
            className="w-full h-full rounded-full border-4 border-loss/50 bg-card shadow-lg grid grid-cols-3 place-items-center text-2xl"
            animate={{ rotate: 1440 }}
            transition={{ duration: 1.6, ease: [0.15, 0.75, 0.25, 1] }}
          >
            {WHEEL_EMOJIS.map((emoji) => <span key={emoji}>{emoji}</span>)}
          </motion.div>
        </div>
        <p className="font-display font-bold">No rerolls.</p>
      </section>
    );
  }

  if (result) {
    const completed = !!result.completed_at;
    return (
      <motion.section
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="rounded-2xl border border-loss/25 bg-gradient-to-br from-loss/10 to-card p-5"
      >
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-loss/15 flex items-center justify-center text-4xl shrink-0">{result.result_emoji}</div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-loss font-bold">Punishment drawn</p>
            <h3 className="font-display font-bold text-xl mt-1">{result.result_label}</h3>
            <p className="text-sm text-muted-foreground mt-1">{result.result_description}</p>
          </div>
        </div>
        {didLose ? (
          completed ? (
            <div className="mt-4 rounded-xl bg-primary/10 text-primary p-3 flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Punishment served
            </div>
          ) : (
            <Button className="w-full mt-4" variant="outline" onClick={handleComplete} disabled={complete.isPending}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {complete.isPending ? 'Recording...' : 'I did it — mark complete'}
            </Button>
          )
        ) : (
          <p className="text-xs text-muted-foreground mt-4">{opponentName} drew this punishment. The result is now part of the league feed.</p>
        )}
      </motion.section>
    );
  }

  if (!didLose) {
    return (
      <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center"><Trophy className="w-5 h-5 text-primary" /></div>
        <div><p className="font-semibold text-sm">{winnerTitle}</p><p className="text-xs text-muted-foreground">{winnerBody}</p></div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-loss/30 bg-loss/5 p-5 text-center">
      <div className="w-14 h-14 rounded-2xl bg-loss/15 flex items-center justify-center mx-auto"><Skull className="w-7 h-7 text-loss" /></div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-loss font-bold mt-3">Final consequence</p>
      <h3 className="font-display font-bold text-xl mt-1">{loserTitle}</h3>
      <p className="text-sm text-muted-foreground mt-2">One spin. No rerolls. The result goes into the league feed.</p>
      <Button onClick={handleSpin} disabled={spin.isPending} className="w-full mt-4 bg-loss text-loss-foreground hover:bg-loss/90">
        {spin.isPending ? 'Locking in your fate...' : '🎡 SPIN THE PUNISHMENT WHEEL'}
      </Button>
    </section>
  );
}
