import { CheckCircle, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type ScoringMode = 'binary' | 'detailed';

interface ScoringModePromptProps {
  value: ScoringMode;
  onChange: (value: ScoringMode) => void;
  disabled?: boolean;
}

export function ScoringModePrompt({ value, onChange, disabled }: ScoringModePromptProps) {
  return (
    <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
      <p className="font-medium text-sm">How would you like to score this task?</p>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => !disabled && onChange('binary')}
          disabled={disabled}
          className={cn(
            "p-3 border-2 rounded-lg text-left transition-all",
            value === 'binary' 
              ? "border-primary bg-primary/10" 
              : "border-border hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <CheckCircle className="w-5 h-5 text-primary mb-2" />
          <p className="font-medium text-sm">Simple (Yes/No)</p>
          <p className="text-xs text-muted-foreground mt-1">
            Did you complete the task today? Earn points for checking it off.
          </p>
        </button>
        
        <button
          type="button"
          onClick={() => !disabled && onChange('detailed')}
          disabled={disabled}
          className={cn(
            "p-3 border-2 rounded-lg text-left transition-all",
            value === 'detailed' 
              ? "border-secondary bg-secondary/10" 
              : "border-border hover:border-secondary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Gauge className="w-5 h-5 text-secondary mb-2" />
          <p className="font-medium text-sm">Detailed (Performance)</p>
          <p className="text-xs text-muted-foreground mt-1">
            Track specific values like time, reps, or duration. More points for better performance.
          </p>
        </button>
      </div>
    </div>
  );
}
