import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Timer } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DurationCheckinInputProps {
  value: number; // minutes
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number; // default step for increment/decrement
  threshold?: number; // target threshold in minutes
  unit?: 'minutes' | 'hours';
}

export function DurationCheckinInput({
  value,
  onChange,
  disabled = false,
  min = 0,
  max = 480, // 8 hours max
  step = 5,
  threshold,
  unit = 'minutes',
}: DurationCheckinInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setLocalValue(inputValue);
    
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseInt(localValue, 10);
    if (isNaN(parsed) || parsed < min) {
      setLocalValue(min.toString());
      onChange(min);
    } else if (parsed > max) {
      setLocalValue(max.toString());
      onChange(max);
    }
  };

  const increment = () => {
    const newValue = Math.min(value + step, max);
    onChange(newValue);
  };

  const decrement = () => {
    const newValue = Math.max(value - step, min);
    onChange(newValue);
  };

  const meetsThreshold = threshold !== undefined ? value >= threshold : null;

  // Quick duration buttons
  const quickDurations = [5, 10, 15, 30, 45, 60];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={decrement}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
            'bg-muted text-muted-foreground hover:bg-loss/20 hover:text-loss',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          disabled={disabled || value <= min}
        >
          <Minus className="w-4 h-4" />
        </motion.button>

        <div className="relative flex-1">
          <Timer className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="number"
            value={localValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            disabled={disabled}
            min={min}
            max={max}
            className={cn(
              'text-center text-lg font-semibold pl-10 pr-12',
              '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
              meetsThreshold === true && 'border-primary ring-1 ring-primary/20',
              meetsThreshold === false && value > 0 && 'border-pending ring-1 ring-pending/20'
            )}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            min
          </span>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={increment}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
            'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          disabled={disabled || value >= max}
        >
          <Plus className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Quick duration buttons */}
      <div className="flex flex-wrap gap-2">
        {quickDurations.map((duration) => (
          <motion.button
            key={duration}
            whileTap={{ scale: 0.95 }}
            onClick={() => !disabled && onChange(duration)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              value === duration
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            disabled={disabled}
          >
            {duration}m
          </motion.button>
        ))}
      </div>

      {threshold !== undefined && (
        <div className={cn(
          'text-xs font-medium flex items-center gap-1',
          meetsThreshold ? 'text-primary' : 'text-muted-foreground'
        )}>
          {meetsThreshold ? '✓' : '○'} Goal: {threshold} minutes
          {meetsThreshold && ' - Complete!'}
        </div>
      )}
    </div>
  );
}
