import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface BinaryCheckinInputProps {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function BinaryCheckinInput({
  value,
  onChange,
  disabled = false,
  label = 'Completed',
}: BinaryCheckinInputProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => !disabled && onChange(false)}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
            !value && !disabled
              ? 'bg-loss/20 text-loss ring-1 ring-loss/50'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
          disabled={disabled}
        >
          <X className="w-5 h-5" />
        </motion.button>
        <Switch
          checked={value}
          onCheckedChange={onChange}
          disabled={disabled}
          className="data-[state=checked]:bg-primary"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => !disabled && onChange(true)}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
            value && !disabled
              ? 'bg-primary/20 text-primary ring-1 ring-primary/50'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
          disabled={disabled}
        >
          <Check className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
