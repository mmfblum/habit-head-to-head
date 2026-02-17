import { Zap, Flame, Skull } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type QuickStartDifficulty = 'easy' | 'medium' | 'extreme';

interface DifficultyQuickStartProps {
  onSelect: (difficulty: QuickStartDifficulty) => void;
  disabled?: boolean;
}

export const DIFFICULTY_PRESETS: Record<QuickStartDifficulty, {
  label: string;
  icon: typeof Zap;
  color: string;
  values: {
    'Wake Time': { target_time: string };
    'Workout': { threshold: number };
    'Reading': { threshold: number };
    'Steps': { target: number };
    'Journaling': { binary_points: number };
  };
}> = {
  easy: {
    label: 'Easy',
    icon: Zap,
    color: 'text-green-500',
    values: {
      'Wake Time': { target_time: '07:30' },
      'Workout': { threshold: 20 },
      'Reading': { threshold: 15 },
      'Steps': { target: 5000 },
      'Journaling': { binary_points: 10 },
    },
  },
  medium: {
    label: 'Medium',
    icon: Flame,
    color: 'text-amber-500',
    values: {
      'Wake Time': { target_time: '06:30' },
      'Workout': { threshold: 30 },
      'Reading': { threshold: 20 },
      'Steps': { target: 8000 },
      'Journaling': { binary_points: 10 },
    },
  },
  extreme: {
    label: 'Extreme',
    icon: Skull,
    color: 'text-red-500',
    values: {
      'Wake Time': { target_time: '05:30' },
      'Workout': { threshold: 45 },
      'Reading': { threshold: 30 },
      'Steps': { target: 12000 },
      'Journaling': { binary_points: 10 },
    },
  },
};

export function DifficultyQuickStart({ onSelect, disabled }: DifficultyQuickStartProps) {
  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardContent className="py-4">
        <p className="font-medium mb-3 text-center">Quick Start - Choose Your Difficulty</p>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(DIFFICULTY_PRESETS) as QuickStartDifficulty[]).map((difficulty) => {
            const preset = DIFFICULTY_PRESETS[difficulty];
            const Icon = preset.icon;
            return (
              <Button
                key={difficulty}
                variant="outline"
                onClick={() => onSelect(difficulty)}
                disabled={disabled}
                className="flex-col h-auto py-3"
              >
                <Icon className={`w-5 h-5 mb-1 ${preset.color}`} />
                <span>{preset.label}</span>
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Selects 5 tasks with pre-configured values
        </p>
      </CardContent>
    </Card>
  );
}
