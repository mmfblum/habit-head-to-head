import { Dumbbell, Gauge, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type Difficulty = 'casual' | 'standard' | 'hardcore';
export type DifficultyPresetValues = Record<string, string | number>;

interface DifficultyPreset {
  label: string;
  icon: React.ReactNode;
  description: string;
  values: DifficultyPresetValues;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  casual: {
    label: 'Casual',
    icon: <Gauge className="w-5 h-5" />,
    description: 'Easy wins, low pressure',
    values: {
      steps: 5000,
      workout: 15,
      reading: 10,
      journaling: 3,
      meditation: 5,
      water: 5,
      screen_time: 180,
      wake_time: '08:00',
      bedtime: '23:30',
    },
  },
  standard: {
    label: 'Standard',
    icon: <Dumbbell className="w-5 h-5" />,
    description: 'Balanced daily challenge',
    values: {
      steps: 10000,
      workout: 30,
      reading: 20,
      journaling: 5,
      meditation: 10,
      water: 8,
      screen_time: 120,
      wake_time: '07:00',
      bedtime: '23:00',
    },
  },
  hardcore: {
    label: 'Hardcore',
    icon: <Zap className="w-5 h-5" />,
    description: 'Serious discipline mode',
    values: {
      steps: 15000,
      workout: 45,
      reading: 30,
      journaling: 10,
      meditation: 20,
      water: 10,
      screen_time: 90,
      wake_time: '06:00',
      bedtime: '22:30',
    },
  },
};

interface DifficultyPresetsProps {
  selected: Difficulty;
  onSelect: (difficulty: Difficulty) => void;
  onApply: (values: DifficultyPresetValues) => void;
}

export function DifficultyPresets({ selected, onSelect, onApply }: DifficultyPresetsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(DIFFICULTY_PRESETS) as Difficulty[]).map((difficulty) => {
          const preset = DIFFICULTY_PRESETS[difficulty];
          const isSelected = selected === difficulty;
          return (
            <Card
              key={difficulty}
              onClick={() => onSelect(difficulty)}
              className={`p-3 cursor-pointer transition-all text-center ${
                isSelected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'hover:border-primary/40 hover:bg-muted/50'
              }`}
            >
              <div className={`mx-auto w-9 h-9 rounded-full flex items-center justify-center mb-2 ${
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {preset.icon}
              </div>
              <p className="text-sm font-semibold">{preset.label}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                {preset.description}
              </p>
            </Card>
          );
        })}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => onApply(DIFFICULTY_PRESETS[selected].values)}
      >
        Apply {DIFFICULTY_PRESETS[selected].label} Preset
      </Button>
    </div>
  );
}
