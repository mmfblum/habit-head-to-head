import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface TimeConfigInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}

export function TimeConfigInput({ value, onChange, label, description }: TimeConfigInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
    </div>
  );
}
