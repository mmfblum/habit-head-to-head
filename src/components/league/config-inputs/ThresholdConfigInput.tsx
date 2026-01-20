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
}

export function ThresholdConfigInput({
  value,
  onChange,
  label,
  unit,
  min = 1,
  max = 999,
  description,
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
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          min={min}
          max={max}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}
