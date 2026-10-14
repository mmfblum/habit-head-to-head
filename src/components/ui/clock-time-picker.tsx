import { useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ClockTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

function parseTime(value: string) {
  const [rawHour = '7', rawMinute = '0'] = value.split(':');
  const hour24 = Math.min(23, Math.max(0, Number(rawHour) || 0));
  const minute = Math.min(59, Math.max(0, Number(rawMinute) || 0));
  return {
    hour: hour24 % 12 || 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM' as 'AM' | 'PM',
  };
}

function to24Hour(hour: number, minute: number, period: 'AM' | 'PM') {
  const hour24 = period === 'PM' ? (hour % 12) + 12 : hour % 12;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTime(value: string) {
  if (!value) return '';
  const parsed = parseTime(value);
  return `${parsed.hour}:${String(parsed.minute).padStart(2, '0')} ${parsed.period}`;
}

export function ClockTimePicker({ value, onChange, disabled, className, placeholder = 'Choose time' }: ClockTimePickerProps) {
  const initial = useMemo(() => parseTime(value || '07:00'), [value]);
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period);

  const openPicker = () => {
    const parsed = parseTime(value || '07:00');
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setPeriod(parsed.period);
    setOpen(true);
  };

  const save = () => {
    onChange(to24Hour(hour, minute, period));
    setOpen(false);
  };

  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={openPicker} className={cn('w-full justify-between h-11', className)}>
        <span className={value ? 'font-semibold' : 'text-muted-foreground'}>{value ? formatTime(value) : placeholder}</span>
        <Clock3 className="w-4 h-4 text-muted-foreground" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Choose a time</DialogTitle></DialogHeader>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-center text-4xl font-display font-bold mb-5">{hour}:{String(minute).padStart(2, '0')} <span className="text-xl text-muted-foreground">{period}</span></div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <select aria-label="Hour" value={hour} onChange={(event) => setHour(Number(event.target.value))} className="h-12 rounded-xl border border-border bg-background px-3 text-center font-semibold">
                {Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select aria-label="Minute" value={minute} onChange={(event) => setMinute(Number(event.target.value))} className="h-12 rounded-xl border border-border bg-background px-3 text-center font-semibold">
                {Array.from({ length: 60 }, (_, index) => index).map((item) => <option key={item} value={item}>{String(item).padStart(2, '0')}</option>)}
              </select>
              <div className="grid grid-rows-2 gap-1">
                {(['AM', 'PM'] as const).map((item) => (
                  <button key={item} type="button" onClick={() => setPeriod(item)} className={cn('rounded-lg border px-3 text-xs font-bold', period === item ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background')}>{item}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save}>Set time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
