import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TimeCheckinInputProps {
  value: string; // HH:MM format
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  targetTime?: string;
  isBefore?: boolean; // true = need to be before target, false = need to be after
}

export function TimeCheckinInput({
  value,
  onChange,
  disabled = false,
  label = 'Time',
  targetTime,
  isBefore = true,
}: TimeCheckinInputProps) {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  };

  // Determine if the current value meets the target
  const meetsTarget = (): boolean | null => {
    if (!value || !targetTime) return null;
    
    const [valueHours, valueMinutes] = value.split(':').map(Number);
    const [targetHours, targetMinutes] = targetTime.split(':').map(Number);
    
    const valueTotal = valueHours * 60 + valueMinutes;
    const targetTotal = targetHours * 60 + targetMinutes;
    
    return isBefore ? valueTotal <= targetTotal : valueTotal >= targetTotal;
  };

  const targetMet = meetsTarget();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {targetTime && (
          <span className="text-xs text-muted-foreground">
            Target: {isBefore ? 'before' : 'after'} {targetTime}
          </span>
        )}
      </div>
      
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="time"
          value={localValue}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'pl-10 text-lg font-semibold',
            targetMet === true && 'border-primary ring-1 ring-primary/20',
            targetMet === false && 'border-loss ring-1 ring-loss/20'
          )}
        />
      </div>

      {targetMet !== null && (
        <div className={cn(
          'text-xs font-medium',
          targetMet ? 'text-primary' : 'text-loss'
        )}>
          {targetMet ? '✓ Target met!' : '✗ Target not met'}
        </div>
      )}
    </div>
  );
}
