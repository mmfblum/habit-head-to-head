import { useState } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { TaskTemplate } from '@/hooks/useTaskTemplates';
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
  custom_name?: string;
  custom_description?: string;
  daily_limit_minutes?: number;
  [key: string]: unknown;
}

interface TaskConfigurationPanelProps {
  template: TaskTemplate;
  config: TaskConfigOverrides;
  onChange: (config: TaskConfigOverrides) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function getInitialConfig(template: TaskTemplate): TaskConfigOverrides {
  const defaults = (template.default_config || {}) as Record<string, unknown>;
  const defaultBinaryPoints = typeof defaults.binary_points === 'number' ? defaults.binary_points : 3;

  return {
    scoring_mode: 'binary',
    ...defaults,
    binary_points: defaultBinaryPoints,
  } as TaskConfigOverrides;
}

function getDefaultValue(template: TaskTemplate, field: string): unknown {
  const config = (template.default_config || {}) as Record<string, unknown>;
  return config[field];
}

export function TaskConfigurationPanel({
  template,
  config,
  onChange,
  isExpanded,
  onToggleExpand,
}: TaskConfigurationPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = isExpanded !== undefined;
  const open = controlled ? isExpanded : internalOpen;

  const setOpen = (nextOpen: boolean) => {
    if (controlled) {
      if (nextOpen !== open) onToggleExpand?.();
    } else {
      setInternalOpen(nextOpen);
    }
  };

  const updateField = <K extends keyof TaskConfigOverrides>(field: K, value: TaskConfigOverrides[K]) => {
    onChange({ ...config, [field]: value });
  };

  const hasTimeGoal = template.input_type === 'time'
    || template.scoring_type === 'time_before'
    || template.scoring_type === 'time_after';
  const hasNumericGoal = template.scoring_type === 'threshold'
    || template.scoring_type === 'linear_per_unit'
    || template.scoring_type === 'tiered';
  const canEditPerformancePoints = template.input_type === 'binary'
    || template.scoring_type === 'binary_yesno'
    || template.scoring_type === 'threshold'
    || hasTimeGoal;

  const unitLabel = template.unit === 'steps' ? 'steps' :
    template.unit === 'minutes' ? 'minutes' :
    template.unit === 'pages' ? 'pages' :
    template.unit === 'count' ? 'times' : template.unit;

  const currentTargetTime = config.target_time ?? String(getDefaultValue(template, 'target_time') ?? '07:00');
  const currentThreshold = config.threshold
    ?? config.target
    ?? Number(getDefaultValue(template, 'threshold') ?? getDefaultValue(template, 'target') ?? 30);
  const currentPoints = config.points
    ?? Number(
      getDefaultValue(template, 'points')
      ?? getDefaultValue(template, 'points_at_threshold')
      ?? getDefaultValue(template, 'points_on_time')
      ?? 3
    );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-t border-border/50 mt-3 pt-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Goal & scoring
            </span>
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pt-3 space-y-4" onClick={(event) => event.stopPropagation()}>
            <ScoringModeToggle
              value={config.scoring_mode}
              onChange={(mode) => updateField('scoring_mode', mode)}
            />

            {(hasTimeGoal || hasNumericGoal) && (
              <div className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily goal</p>
                {hasTimeGoal ? (
                  <TimeConfigInput
                    value={currentTargetTime}
                    onChange={(value) => updateField('target_time', value)}
                    label={template.name.toLowerCase().includes('wake') ? 'Wake by' : 'Complete by'}
                  />
                ) : (
                  <ThresholdConfigInput
                    value={currentThreshold}
                    onChange={(value) => {
                      if (template.scoring_type === 'linear_per_unit') updateField('target', value);
                      else updateField('threshold', value);
                    }}
                    unit={unitLabel}
                    label="Hit this each day"
                    min={Number(template.min_value ?? 0)}
                    max={Number(template.max_value ?? 100000)}
                  />
                )}
              </div>
            )}

            {config.scoring_mode === 'detailed' && canEditPerformancePoints && (
              <div className="space-y-3 rounded-xl border border-secondary/20 bg-secondary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Performance scoring</p>
                <PointsConfigInput
                  value={currentPoints}
                  onChange={(value) => updateField('points', value)}
                  label="Points at the goal"
                />
              </div>
            )}

            <ScoringPreview task={template} config={config} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
