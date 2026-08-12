import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BinaryCheckinInputProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function BinaryCheckinInput({ value, onChange, disabled = false, label = 'Did you complete it?' }: BinaryCheckinInputProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => !disabled && onChange(false)}
          className={cn(
            'h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all border',
            !value
              ? 'bg-loss/10 text-loss border-loss/30'
              : 'bg-muted/60 text-muted-foreground border-border hover:bg-muted'
          )}
          disabled={disabled}
        >
          <X className="w-4 h-4" />
          Missed
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => !disabled && onChange(true)}
          className={cn(
            'h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all border',
            value
              ? 'bg-primary text-primary-foreground border-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)]'
              : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
          )}
          disabled={disabled}
        >
          <Check className="w-4 h-4" />
          Done — score it
        </motion.button>
      </div>
    </div>
  );
}
