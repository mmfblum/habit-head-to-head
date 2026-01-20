import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CheckCircle, Gauge } from 'lucide-react';

export type ScoringMode = 'binary' | 'detailed';

interface ScoringModeToggleProps {
  value: ScoringMode;
  onChange: (value: ScoringMode) => void;
  disabled?: boolean;
}

export function ScoringModeToggle({ value, onChange, disabled }: ScoringModeToggleProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Scoring Mode</p>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as ScoringMode)}
        disabled={disabled}
        className="justify-start"
      >
        <ToggleGroupItem
          value="binary"
          className="flex items-center gap-2 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <CheckCircle className="w-4 h-4" />
          <span>Simple (Yes/No)</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="detailed"
          className="flex items-center gap-2 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <Gauge className="w-4 h-4" />
          <span>Detailed</span>
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        {value === 'binary'
          ? 'Award points for completing the task (yes/no)'
          : 'Award points based on performance metrics'}
      </p>
    </div>
  );
}
