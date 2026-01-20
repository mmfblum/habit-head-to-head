import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NumericCheckinInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
}

export function NumericCheckinInput({
  value,
  onChange,
  disabled = false,
  min = 0,
  max = 100000,
  step = 1,
  unit = '',
  placeholder = '0',
}: NumericCheckinInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setLocalValue(inputValue);
    
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localValue);
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

  // Determine step size based on unit for better UX
  const displayStep = unit === 'steps' ? 1000 : unit === 'pages' ? 5 : step;

  return (
    <div className="flex items-center gap-2">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          const newValue = Math.max(value - displayStep, min);
          onChange(newValue);
        }}
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
        <Input
          type="number"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className="text-center text-lg font-semibold pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          const newValue = Math.min(value + displayStep, max);
          onChange(newValue);
        }}
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
  );
}
