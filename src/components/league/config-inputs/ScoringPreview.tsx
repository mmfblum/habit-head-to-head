import { Info } from 'lucide-react';
import { TaskTemplate } from '@/hooks/useTaskTemplates';
import { TaskConfigOverrides } from '../TaskConfigurationPanel';

interface ScoringPreviewProps {
  template: TaskTemplate;
  config: TaskConfigOverrides;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function addMinutesToTime(time: string, minutesToAdd: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

function subtractMinutesFromTime(time: string, minutesToSubtract: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes - minutesToSubtract;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

export function ScoringPreview({ template, config }: ScoringPreviewProps) {
  const examples = generateExamples(template, config);

  if (examples.length === 0) return null;

  return (
    <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <Info className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Scoring Examples</span>
      </div>
      <div className="space-y-1.5">
        {examples.map((example, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{example.scenario}</span>
            <span className={`font-medium ${example.points > 0 ? 'text-primary' : 'text-destructive'}`}>
              {example.points > 0 ? '+' : ''}{example.points} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Example {
  scenario: string;
  points: number;
}

function generateExamples(template: TaskTemplate, config: TaskConfigOverrides): Example[] {
  const defaultConfig = template.default_config as Record<string, any>;

  // Binary mode - simple examples
  if (config.scoring_mode === 'binary') {
    const points = 10;
    return [
      { scenario: 'Completed', points },
      { scenario: 'Not completed', points: 0 },
    ];
  }

  // Detailed mode examples based on scoring type
  switch (template.scoring_type) {
    case 'time_after': {
      const targetTime = config.target_time || defaultConfig?.target_time || '06:30';
      const pointsOnTime = config.points || defaultConfig?.points_on_time || 50;
      const penaltyPerMin = defaultConfig?.penalty_per_minute || 1;

      return [
        { scenario: `Wake at ${formatTime(subtractMinutesFromTime(targetTime, 15))} (early)`, points: pointsOnTime },
        { scenario: `Wake at ${formatTime(targetTime)} (on time)`, points: pointsOnTime },
        { scenario: `Wake at ${formatTime(addMinutesToTime(targetTime, 30))} (+30 min late)`, points: pointsOnTime - (30 * penaltyPerMin) },
        { scenario: `Wake at ${formatTime(addMinutesToTime(targetTime, 60))} (+1 hr late)`, points: pointsOnTime - (60 * penaltyPerMin) },
      ];
    }

    case 'time_before': {
      const targetTime = config.target_time || defaultConfig?.target_time || '22:30';
      const pointsOnTime = config.points || defaultConfig?.points_on_time || 50;
      const penaltyPerMin = defaultConfig?.penalty_per_minute || 1;

      return [
        { scenario: `In bed by ${formatTime(subtractMinutesFromTime(targetTime, 15))} (early)`, points: pointsOnTime },
        { scenario: `In bed by ${formatTime(targetTime)} (on time)`, points: pointsOnTime },
        { scenario: `In bed by ${formatTime(addMinutesToTime(targetTime, 30))} (+30 min late)`, points: pointsOnTime - (30 * penaltyPerMin) },
        { scenario: `In bed by ${formatTime(addMinutesToTime(targetTime, 60))} (+1 hr late)`, points: pointsOnTime - (60 * penaltyPerMin) },
      ];
    }

    case 'threshold': {
      const threshold = config.threshold || defaultConfig?.threshold || 30;
      const pointsAtThreshold = config.points || defaultConfig?.points_at_threshold || 50;
      const bonusPerUnit = defaultConfig?.bonus_per_unit || 1;
      const maxBonus = defaultConfig?.max_bonus || 20;

      return [
        { scenario: `Complete ${Math.floor(threshold * 0.5)} min (below goal)`, points: 0 },
        { scenario: `Complete ${threshold} min (hit goal)`, points: pointsAtThreshold },
        { scenario: `Complete ${threshold + 20} min (+20 bonus)`, points: Math.min(pointsAtThreshold + (20 * bonusPerUnit), pointsAtThreshold + maxBonus) },
      ];
    }

    case 'linear_per_unit': {
      const target = config.target || defaultConfig?.target || 10000;
      const pointsPerUnit = defaultConfig?.points_per_unit || 5;
      const unitSize = defaultConfig?.unit_size || 1000;
      const maxPoints = config.points || defaultConfig?.max_points || 50;

      const halfTarget = Math.floor(target / 2);
      const halfPoints = Math.min(Math.floor(halfTarget / unitSize) * pointsPerUnit, maxPoints);
      const fullPoints = Math.min(Math.floor(target / unitSize) * pointsPerUnit, maxPoints);

      return [
        { scenario: `${halfTarget.toLocaleString()} (${Math.floor(halfTarget / target * 100)}% of goal)`, points: halfPoints },
        { scenario: `${target.toLocaleString()} (100% of goal)`, points: fullPoints },
        { scenario: `${(target * 1.5).toLocaleString()} (150% of goal)`, points: maxPoints },
      ];
    }

    case 'tiered': {
      const maxPoints = config.points || 50;
      return [
        { scenario: 'Under 1 hour', points: maxPoints },
        { scenario: '1-2 hours', points: Math.floor(maxPoints * 0.6) },
        { scenario: '2-3 hours', points: Math.floor(maxPoints * 0.2) },
        { scenario: 'Over 3 hours', points: 0 },
      ];
    }

    case 'binary_yesno': {
      const points = config.points || defaultConfig?.points || 50;
      return [
        { scenario: 'Completed', points },
        { scenario: 'Not completed', points: 0 },
      ];
    }

    default:
      return [];
  }
}
