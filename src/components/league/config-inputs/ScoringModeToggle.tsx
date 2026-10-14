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
      <p className="text-sm font-medium">How should this task score?</p>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(nextValue) => nextValue && onChange(nextValue as ScoringMode)}
        disabled={disabled}
        className="grid grid-cols-2 gap-2"
      >
        <ToggleGroupItem
          value="binary"
          className="h-auto min-h-16 flex-col items-start gap-1 px-3 py-2 text-left data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=on]:border-primary/40"
        >
          <span className="flex items-center gap-2 font-semibold">
            <CheckCircle className="w-4 h-4" />
            Hit the goal
          </span>
          <span className="text-[11px] font-normal opacity-75">Same points when the daily goal is met.</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="detailed"
          className="h-auto min-h-16 flex-col items-start gap-1 px-3 py-2 text-left data-[state=on]:bg-secondary/15 data-[state=on]:text-secondary data-[state=on]:border-secondary/40"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Gauge className="w-4 h-4" />
            Score performance
          </span>
          <span className="text-[11px] font-normal opacity-75">More or fewer points based on what you actually do.</span>
        </ToggleGroupItem>
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        {value === 'binary'
          ? 'Best for a fair, easy-to-follow league: every selected task is worth the same base points.'
          : 'Best for competitive groups that want extra steps, minutes, or other performance to matter.'}
      </p>
    </div>
  );
}
