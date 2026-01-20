import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface PointsConfigInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  description?: string;
  min?: number;
  max?: number;
}

export function PointsConfigInput({
  value,
  onChange,
  label = 'Points',
  description,
  min = 1,
  max = 100,
}: PointsConfigInputProps) {
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
          className="w-20"
        />
        <span className="text-sm text-muted-foreground">pts</span>
      </div>
    </div>
  );
}
