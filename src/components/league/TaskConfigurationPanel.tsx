import { useState } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TaskTemplate } from '@/hooks/useTaskTemplates';
import { ScoringModeToggle } from './config-inputs/ScoringModeToggle';
import { TimeConfigInput } from './config-inputs/TimeConfigInput';
import { ThresholdConfigInput } from './config-inputs/ThresholdConfigInput';
import { PointsConfigInput } from './config-inputs/PointsConfigInput';
import { ScoringPreview } from './config-inputs/ScoringPreview';

export interface TaskConfigOverrides {
  scoring_mode: 'binary' | 'detailed';
  target_time?: string;
  threshold?: number;
  target?: number;
  points?: number;
  binary_points?: number;
  max_tiers?: number;
  [key: string]: unknown;
}

interface TaskConfigurationPanelProps {
  task: TaskTemplate;
  config: TaskConfigOverrides;
  onChange: (config: TaskConfigOverrides) => void;
}

export function getInitialConfig(task: TaskTemplate): TaskConfigOverrides {
  const defaults = (task.default_config || {}) as Record<string, unknown>;
  const defaultBinaryPoints = typeof defaults.binary_points === 'number' ? defaults.binary_points : 3;

  return {
    scoring_mode: 'binary',
    ...defaults,
    binary_points: defaultBinaryPoints,
  } as TaskConfigOverrides;
}

function getDefaultValue(task: TaskTemplate, field: string): unknown {
  const config = (task.default_config || {}) as Record<string, unknown>;
  return config[field];
}

export function TaskConfigurationPanel({ task, config, onChange }: TaskConfigurationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateField = <K extends keyof TaskConfigOverrides>(field: K, value: TaskConfigOverrides[K]) => {
    onChange({ ...config, [field]: value });
  };

  const hasTimeConfig = task.input_type === 'time' || task.scoring_type === 'time_before' || task.scoring_type === 'time_after';
  const hasThresholdConfig = task.scoring_type === 'threshold' || task.scoring_type === 'linear_per_unit';
  const hasPointsConfig = task.input_type === 'binary' || task.scoring_type === 'binary_yesno';

  const unitLabel = task.unit === 'steps' ? 'steps' :
    task.unit === 'minutes' ? 'minutes' :
    task.unit === 'pages' ? 'pages' :
    task.unit === 'count' ? 'reps' : task.unit;

  const currentTargetTime = config.target_time ?? String(getDefaultValue(task, 'target_time') ?? '07:00');
  const currentThreshold = config.threshold ?? config.target ?? Number(getDefaultValue(task, 'threshold') ?? getDefaultValue(task, 'target') ?? 30);
  const currentPoints = config.points ?? Number(getDefaultValue(task, 'points') ?? getDefaultValue(task, 'points_at_threshold') ?? 50);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-t border-border/50 mt-2 pt-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Configure Scoring
            </span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div
            className="pt-3 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <ScoringModeToggle
              value={config.scoring_mode}
              onChange={(mode) => updateField('scoring_mode', mode)}
            />

            {config.scoring_mode === 'detailed' && (
              <div className="space-y-4 pt-2 border-t border-border/30">
                {hasTimeConfig && (
                  <TimeConfigInput
                    value={currentTargetTime}
                    onChange={(value) => updateField('target_time', value)}
                    label={task.name.toLowerCase().includes('wake') ? 'Wake by' : 'Complete by'}
                  />
                )}

                {hasThresholdConfig && !hasTimeConfig && (
                  <ThresholdConfigInput
                    value={currentThreshold}
                    onChange={(value) => {
                      if (task.scoring_type === 'linear_per_unit') {
                        updateField('target', value);
                      } else {
                        updateField('threshold', value);
                      }
                    }}
                    unit={unitLabel}
                    label="Daily Target"
                    min={Number(task.min_value ?? 0)}
                    max={Number(task.max_value ?? 100000)}
                  />
                )}

                {hasPointsConfig && (
                  <PointsConfigInput
                    value={currentPoints}
                    onChange={(value) => updateField('points', value)}
                    label="Points for Completion"
                  />
                )}
              </div>
            )}

            <ScoringPreview task={task} config={config} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
