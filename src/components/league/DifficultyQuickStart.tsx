import { Dumbbell, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export type StarterPackId = 'classic' | 'fitness' | 'discipline' | 'mind_body';

export interface StarterPack {
  label: string;
  description: string;
  icon: typeof Trophy;
  tasks: string[];
  overrides?: Record<string, Record<string, string | number | boolean>>;
}

interface DifficultyQuickStartProps {
  onSelect: (pack: StarterPackId) => void;
  disabled?: boolean;
}

export const STARTER_PACKS: Record<StarterPackId, StarterPack> = {
  classic: {
    label: 'Classic Zrizin',
    description: 'The balanced default game',
    icon: Trophy,
    tasks: ['Steps', 'Workout', 'Reading', 'Wake Time', 'Screen Time', 'Healthy Eating'],
    overrides: {
      Steps: { target: 10000, binary_points: 3 },
      Workout: { threshold: 30, binary_points: 3 },
      Reading: { threshold: 20, binary_points: 3 },
      'Wake Time': { target_time: '06:30', binary_points: 3 },
      'Screen Time': { daily_limit_minutes: 120, target: 120, binary_points: 3 },
      'Healthy Eating': { binary_points: 3 },
    },
  },
  fitness: {
    label: 'Fitness League',
    description: 'Move, recover, get outside',
    icon: Dumbbell,
    tasks: ['Steps', 'Workout', 'Stretching', 'Outside Time', 'Healthy Eating', 'Sleep Duration'],
  },
  discipline: {
    label: 'Discipline League',
    description: 'Win the day through structure',
    icon: ShieldCheck,
    tasks: ['Wake Time', 'Bedtime', 'Screen Time', 'Reading', 'Healthy Eating', 'Deep Work'],
  },
  mind_body: {
    label: 'Mind & Body',
    description: 'A balanced wellness scorecard',
    icon: Sparkles,
    tasks: ['Workout', 'Reading', 'Meditation', 'Outside Time', 'Stretching', 'Journaling'],
  },
};

export function DifficultyQuickStart({ onSelect, disabled }: DifficultyQuickStartProps) {
  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardContent className="py-4">
        <div className="text-center mb-3">
          <p className="font-semibold">Start with a proven scorecard</p>
          <p className="text-xs text-muted-foreground mt-1">Pick a league style. You can change any task afterward.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(STARTER_PACKS) as StarterPackId[]).map((packId) => {
            const pack = STARTER_PACKS[packId];
            const Icon = pack.icon;
            return (
              <button
                type="button"
                key={packId}
                onClick={() => onSelect(packId)}
                disabled={disabled}
                className="rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold">{pack.label}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{pack.description}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{pack.tasks.length} daily scoring chances</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
