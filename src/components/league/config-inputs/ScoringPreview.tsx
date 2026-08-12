import { Calculator, Check, TrendingUp } from 'lucide-react';
import { TaskTemplate } from '@/hooks/useTaskTemplates';
import { TaskConfigOverrides } from '../TaskConfigurationPanel';

interface ScoringPreviewProps {
  task: TaskTemplate;
  config: TaskConfigOverrides;
}

function getDefault(task: TaskTemplate, key: string, fallback: number | string): number | string {
  const defaults = (task.default_config || {}) as Record<string, unknown>;
  const value = defaults[key];
  return typeof value === 'number' || typeof value === 'string' ? value : fallback;
}

export function ScoringPreview({ task, config }: ScoringPreviewProps) {
  const isBinary = config.scoring_mode === 'binary';
  const binaryPoints = config.binary_points ?? 3;

  const renderBinaryPreview = () => (
    <div className="flex items-center justify-center gap-3 py-2">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center">
          <Check className="w-3 h-3" />
        </span>
        <span>Done</span>
        <span className="font-semibold text-primary">+{binaryPoints} pts</span>
      </div>
      <span className="text-muted-foreground">•</span>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">×</span>
        <span>Missed</span>
        <span>0 pts</span>
      </div>
    </div>
  );

  const renderDetailedPreview = () => {
    const scoringType = task.scoring_type;

    if (scoringType === 'time_before') {
      const targetTime = config.target_time ?? getDefault(task, 'target_time', '07:00');
      const points = config.points ?? Number(getDefault(task, 'points_on_time', 50));
      return (
        <div className="text-center text-xs py-2">
          <p className="text-muted-foreground mb-1">Complete by <span className="font-medium text-foreground">{targetTime}</span></p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-primary font-semibold">On time: +{points} pts</span>
            <span className="text-muted-foreground">• Late: reduced</span>
          </div>
        </div>
      );
    }

    if (scoringType === 'threshold') {
      const threshold = config.threshold ?? Number(getDefault(task, 'threshold', 30));
      const points = config.points ?? Number(getDefault(task, 'points_at_threshold', 50));
      const bonus = Number(getDefault(task, 'bonus_per_unit', 1));
      return (
        <div className="text-center text-xs py-2">
          <p className="text-muted-foreground mb-1">
            Hit <span className="font-medium text-foreground">{threshold} {task.unit}</span> → <span className="text-primary font-semibold">+{points} pts</span>
          </p>
          {bonus > 0 && <p className="text-[10px] text-muted-foreground">+{bonus} bonus per unit beyond target</p>}
        </div>
      );
    }

    if (scoringType === 'linear_per_unit') {
      const target = config.target ?? Number(getDefault(task, 'target', 10000));
      const pointsPerUnit = Number(getDefault(task, 'points_per_unit', 5));
      const unitSize = Number(getDefault(task, 'unit_size', 1000));
      const maxPoints = Number(getDefault(task, 'max_points', 50));
      const targetPoints = Math.min((target / unitSize) * pointsPerUnit, maxPoints);
      return (
        <div className="text-center text-xs py-2">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-muted-foreground">Earn as you go</span>
          </div>
          <p>
            <span className="font-medium">{target.toLocaleString()} {task.unit}</span> → <span className="text-primary font-semibold">~{targetPoints} pts</span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">Max: {maxPoints} pts/day</p>
        </div>
      );
    }

    if (scoringType === 'tiered') {
      const tiers = Number(config.max_tiers ?? 3);
      return (
        <div className="text-center text-xs py-2">
          <p className="text-muted-foreground mb-1">Tiered scoring with {tiers} levels</p>
          <div className="flex items-center justify-center gap-1">
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">Bronze</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary">Silver</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded bg-secondary/20 text-secondary">Gold</span>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center text-xs py-2 text-muted-foreground">
        Detailed scoring based on your input
      </div>
    );
  };

  return (
    <div className="bg-muted/30 rounded-lg p-2 border border-border/50">
      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        <Calculator className="w-3 h-3" />
        Scoring Preview
      </div>
      {isBinary ? renderBinaryPreview() : renderDetailedPreview()}
    </div>
  );
}
