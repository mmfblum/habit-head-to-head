import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ThresholdConfigInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  description?: string;
  step?: number;
}

export function ThresholdConfigInput({
  value,
  onChange,
  label,
  unit,
  min = 1,
  max = 999,
  description,
  step = 1,
}: ThresholdConfigInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const parsed = Number.parseFloat(e.target.value);
            if (Number.isFinite(parsed)) onChange(Math.max(min, Math.min(max, parsed)));
          }}
          min={min}
          max={max}
          step={step}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
