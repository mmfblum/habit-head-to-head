import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CONFIRMATION_LABELS } from '@/lib/verification';

interface ConfirmationButtonProps {
  confirmationAction: string;
  isConfirmed: boolean;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  capturesTimestamp?: boolean;
  className?: string;
}

export function ConfirmationButton({
  confirmationAction,
  isConfirmed,
  onConfirm,
  disabled,
  capturesTimestamp,
  className,
}: ConfirmationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isScoreAction = confirmationAction === 'log_score';
  const config = isScoreAction
    ? { label: 'Score it', icon: '⚡' }
    : CONFIRMATION_LABELS[confirmationAction] || { label: 'Confirm', icon: '✓' };

  const handleConfirm = async () => {
    if (isConfirmed || isLoading || disabled) return;
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('w-full', className)}>
      <Button
        onClick={handleConfirm}
        disabled={disabled || isLoading}
        variant={isConfirmed ? 'default' : isScoreAction ? 'default' : 'outline'}
        className={cn(
          'w-full h-12 text-base font-semibold transition-all duration-300',
          isScoreAction && !isConfirmed && 'shadow-[0_0_24px_hsl(var(--primary)/0.18)]',
          isConfirmed && 'bg-primary text-primary-foreground',
          !isConfirmed && !disabled && !isScoreAction && 'hover:bg-primary/10 hover:border-primary'
        )}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Scoring...</span>
            </motion.div>
          ) : isConfirmed ? (
            <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span>Scored!</span>
            </motion.div>
          ) : (
            <motion.div key="action" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
              {isScoreAction ? <Zap className="w-5 h-5" /> : <span className="text-lg">{config.icon}</span>}
              <span>{config.label}</span>
              {capturesTimestamp && <span className="text-xs bg-muted px-2 py-0.5 rounded-full ml-1">Now</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {!isConfirmed && !disabled && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          {capturesTimestamp
            ? 'Your current time will be recorded'
            : isScoreAction
              ? 'One tap logs the result and updates your matchup.'
              : 'Tap to confirm and earn points'}
        </p>
      )}
    </motion.div>
  );
}
