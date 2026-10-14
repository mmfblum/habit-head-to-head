import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ClockTimePicker } from '@/components/ui/clock-time-picker';

interface TimeCheckinInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  targetTime?: string;
  isBefore?: boolean;
}

function friendlyTime(value: string) {
  const [hourText, minute = '00'] = value.split(':');
  const hour24 = Number(hourText);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

export function TimeCheckinInput({ value, onChange, disabled = false, label = 'Time', targetTime, isBefore = true }: TimeCheckinInputProps) {
  const [localValue, setLocalValue] = useState(value || '');
  useEffect(() => setLocalValue(value || ''), [value]);

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
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        {targetTime && <span className="text-xs text-muted-foreground">Target: {isBefore ? 'by' : 'after'} {friendlyTime(targetTime)}</span>}
      </div>
      <ClockTimePicker value={localValue} onChange={(next) => { setLocalValue(next); onChange(next); }} disabled={disabled} className={cn(targetMet === true && 'border-primary ring-1 ring-primary/20', targetMet === false && 'border-loss ring-1 ring-loss/20')} />
      {targetMet !== null && <div className={cn('text-xs font-medium', targetMet ? 'text-primary' : 'text-loss')}>{targetMet ? '✓ Target met!' : '✗ Target not met'}</div>}
    </div>
  );
}
