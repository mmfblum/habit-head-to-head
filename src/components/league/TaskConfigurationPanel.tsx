import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Settings2 } from 'lucide-react';
import { TaskTemplate } from '@/hooks/useTaskTemplates';
import {
  TimeConfigInput,
  ThresholdConfigInput,
  ScoringModeToggle,
  PointsConfigInput,
  ScoringPreview,
  type ScoringMode,
} from './config-inputs';

export interface TaskConfigOverrides {
  scoring_mode: ScoringMode;
  target_time?: string;
  threshold?: number;
  target?: number;
  points?: number;
  binary_points?: number;
}

interface TaskConfigurationPanelProps {
  template: TaskTemplate;
  config: TaskConfigOverrides;
  onChange: (config: TaskConfigOverrides) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// Helper to get default config values
function getDefaultConfig(template: TaskTemplate): TaskConfigOverrides {
  const defaultConfig = template.default_config as Record<string, any>;
  
  // Determine if this task should default to binary or detailed
  const isBinaryOnly = template.scoring_type === 'binary_yesno';
  
  return {
    scoring_mode: isBinaryOnly ? 'binary' : 'detailed',
    target_time: defaultConfig?.target_time || '06:30',
    threshold: defaultConfig?.threshold || 30,
    target: defaultConfig?.target || 10,
    points: defaultConfig?.points_on_time || defaultConfig?.points_at_threshold || defaultConfig?.max_points || 50,
    binary_points: defaultConfig?.binary_points || 3,
  };
}

export function getInitialConfig(template: TaskTemplate): TaskConfigOverrides {
  return getDefaultConfig(template);
}

// Get unit label based on template
function getUnitLabel(template: TaskTemplate): string {
  switch (template.unit) {
    case 'minutes':
      return 'minutes';
    case 'steps':
      return 'steps';
    case 'count':
      return template.name.toLowerCase().includes('meal') ? 'meals' : 'times';
    case 'hours':
      return 'hours';
    case 'pages':
      return 'pages';
    default:
      return 'units';
  }
}

// Check if this task supports both modes
function supportsBothModes(template: TaskTemplate): boolean {
  // Binary-only tasks can't switch to detailed
  return template.scoring_type !== 'binary_yesno';
}

export function TaskConfigurationPanel({
  template,
  config,
  onChange,
  isExpanded,
  onToggleExpand,
}: TaskConfigurationPanelProps) {
  const defaultConfig = template.default_config as Record<string, any>;
  const canToggleMode = supportsBothModes(template);

  const updateConfig = (updates: Partial<TaskConfigOverrides>) => {
    onChange({ ...config, ...updates });
  };

  // Render detailed configuration based on scoring type
  const renderDetailedConfig = () => {
    switch (template.scoring_type) {
      case 'time_before':
      case 'time_after':
        return (
          <div className="space-y-4">
            <TimeConfigInput
              label={template.scoring_type === 'time_before' ? 'Bedtime Target' : 'Wake Time Target'}
              description={
                template.scoring_type === 'time_before'
                  ? 'Be in bed by this time to earn full points'
                  : 'Wake up by this time to earn full points'
              }
              value={config.target_time || defaultConfig?.target_time || '06:30'}
              onChange={(value) => updateConfig({ target_time: value })}
            />
            <PointsConfigInput
              label="Points for success"
              value={config.points || defaultConfig?.points_on_time || 50}
              onChange={(value) => updateConfig({ points: value })}
              max={100}
            />
          </div>
        );

      case 'threshold':
        return (
          <div className="space-y-4">
            <ThresholdConfigInput
              label="Minimum required"
              description={`Complete at least this many ${getUnitLabel(template)} to earn points`}
              value={config.threshold || defaultConfig?.threshold || 30}
              onChange={(value) => updateConfig({ threshold: value })}
              unit={getUnitLabel(template)}
              min={1}
              max={999}
            />
            <PointsConfigInput
              label="Points when completed"
              value={config.points || defaultConfig?.points_at_threshold || 50}
              onChange={(value) => updateConfig({ points: value })}
              max={100}
            />
          </div>
        );

      case 'linear_per_unit':
        return (
          <div className="space-y-4">
            <ThresholdConfigInput
              label="Daily target"
              description={`Goal for ${getUnitLabel(template)} per day`}
              value={config.target || defaultConfig?.target || 10000}
              onChange={(value) => updateConfig({ target: value })}
              unit={getUnitLabel(template)}
              min={1}
              max={100000}
            />
            <PointsConfigInput
              label="Max points"
              description="Maximum points earnable per day"
              value={config.points || defaultConfig?.max_points || 50}
              onChange={(value) => updateConfig({ points: value })}
              max={100}
            />
          </div>
        );

      case 'tiered':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Points awarded based on tiers. Lower values = more points.
            </p>
            <PointsConfigInput
              label="Max points (best tier)"
              value={config.points || 50}
              onChange={(value) => updateConfig({ points: value })}
              max={100}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="border-t border-border/50 mt-3 pt-3">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <Settings2 className="w-4 h-4" />
        <span>Configure</span>
        <ChevronDown
          className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">
              {canToggleMode && (
                <ScoringModeToggle
                  value={config.scoring_mode}
                  onChange={(mode) => updateConfig({ scoring_mode: mode })}
                />
              )}

              {config.scoring_mode === 'binary' ? (
                <PointsConfigInput
                  label="Points per completion"
                  description="Points awarded for completing this task"
                  value={config.binary_points || defaultConfig?.binary_points || 3}
                  onChange={(value) => updateConfig({ binary_points: value })}
                  max={50}
                />
              ) : (
                renderDetailedConfig()
              )}

              <ScoringPreview template={template} config={config} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
