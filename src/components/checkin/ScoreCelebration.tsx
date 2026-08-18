import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap } from 'lucide-react';
import { triggerConfetti, triggerScoreHaptic } from '@/lib/confetti';

interface ScoreCelebrationProps {
  points: number;
  taskName: string;
  powerPlay?: boolean;
  isUpdate?: boolean;
  onDone: () => void;
}

export function ScoreCelebration({ points, taskName, powerPlay, isUpdate, onDone }: ScoreCelebrationProps) {
  useEffect(() => {
    triggerScoreHaptic(Boolean(powerPlay));

    // The first firework is launched by the successful scoring action. A Power
    // Play gets a second, clearly separated explosion and a second haptic hit.
    const secondBurst = powerPlay
      ? window.setTimeout(() => triggerConfetti(false), 240)
      : undefined;
    const timeout = window.setTimeout(onDone, powerPlay ? 1950 : 1750);

    return () => {
      window.clearTimeout(timeout);
      if (secondBurst !== undefined) window.clearTimeout(secondBurst);
    };
  }, [onDone, powerPlay]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-background/35 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.55, y: 35, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 1.1, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 20 }}
        className="relative w-[min(86vw,360px)] overflow-hidden rounded-3xl border border-primary/40 bg-card p-7 text-center shadow-2xl"
      >
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{ background: 'var(--gradient-primary)' }}
          animate={{ opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
        <div className="relative">
          <motion.div
            initial={{ rotate: -20, scale: 0 }}
            animate={powerPlay ? { rotate: [0, -8, 8, 0], scale: [0, 1.2, 1] } : { rotate: 0, scale: 1 }}
            transition={{ delay: 0.08, type: 'spring' }}
            className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mx-auto mb-3"
          >
            {powerPlay ? <Zap className="w-7 h-7" /> : <Sparkles className="w-7 h-7" />}
          </motion.div>

          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {powerPlay ? 'Power Play Hit' : isUpdate ? 'Score Updated' : 'Scored'}
          </p>
          <motion.p
            initial={{ scale: 0.7 }}
            animate={{ scale: [0.7, 1.12, 1] }}
            transition={{ delay: 0.08, duration: 0.45 }}
            className="score-text text-6xl font-black text-primary mt-2"
          >
            +{points.toLocaleString()}
          </motion.p>
          <p className="font-display font-bold text-lg mt-2 truncate">{taskName}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {powerPlay ? '2× points. Double explosion.' : 'Points added to your matchup.'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
