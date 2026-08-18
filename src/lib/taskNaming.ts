import type { TaskTemplate } from '@/hooks/useTaskTemplates';

export interface TaskConfigForNaming {
  scoring_mode?: 'binary' | 'detailed';
  target?: number;
  threshold?: number;
  target_time?: string;
  binary_points?: number;
  points?: number;
  custom_name?: string;
  custom_description?: string;
  daily_limit_minutes?: number;
}

function getUnitLabel(template: TaskTemplate): string {
  switch (template.unit) {
    case 'minutes': return 'min';
    case 'steps': return 'steps';
    case 'count': return 'times';
    case 'hours': return 'hours';
    case 'pages': return 'pages';
    case 'words': return 'words';
    case 'miles': return 'miles';
    case 'calories': return 'cal';
    default: return '';
  }
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function defaultNumber(template: TaskTemplate, ...keys: string[]): number | undefined {
  const defaults = (template.default_config || {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = defaults[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function formatQuantityName(baseName: string, template: TaskTemplate, target: number): string {
  const amount = target.toLocaleString();
  switch (template.unit) {
    case 'count': return `${amount} ${baseName}`;
    case 'steps': return `${amount} ${baseName.toLowerCase().includes('step') ? baseName : `steps ${baseName}`}`;
    case 'minutes': return `${amount} min ${baseName}`;
    case 'hours': return `${amount} hr ${baseName}`;
    case 'pages': return `${amount} pages ${baseName}`;
    case 'words': return `${amount} words ${baseName}`;
    case 'miles': return `${amount} mi ${baseName}`;
    case 'calories': return `${amount} cal ${baseName}`;
    default: return `${amount} ${baseName}`;
  }
}

export function getConfiguredTaskName(template: TaskTemplate, config: TaskConfigForNaming): string {
  const baseName = config.custom_name?.trim() || template.name;

  if (config.target_time && (template.unit === 'bedtime_time' || template.unit === 'waketime_time')) {
    return `${baseName} by ${formatTime(config.target_time)}`;
  }

  if (config.daily_limit_minutes !== undefined && config.daily_limit_minutes > 0) {
    return `${baseName} ≤ ${config.daily_limit_minutes.toLocaleString()} min`;
  }

  const target = config.target ?? config.threshold;
  if (target !== undefined && target > 0) return formatQuantityName(baseName, template, target);
  return baseName;
}

export function getTaskScoringSentence(template: TaskTemplate, config: TaskConfigForNaming): string {
  const goalPoints = config.binary_points ?? 3;
  const target = config.daily_limit_minutes ?? config.target ?? config.threshold
    ?? defaultNumber(template, 'daily_limit_minutes', 'target', 'threshold');
  const unit = getUnitLabel(template);
  const targetTime = config.target_time
    ?? ((template.default_config as Record<string, unknown> | null)?.target_time as string | undefined);

  if ((config.scoring_mode ?? 'binary') === 'binary') {
    if (template.input_type === 'binary') return `Complete it → +${goalPoints} pts. Miss it → 0.`;
    if (template.input_type === 'time' && targetTime) return `Hit ${formatTime(targetTime)} → +${goalPoints} pts. Miss it → 0.`;
    if (config.daily_limit_minutes !== undefined && target !== undefined) {
      return `Stay at or under ${target.toLocaleString()} ${unit || 'minutes'} → +${goalPoints} pts.`;
    }
    if (target !== undefined) return `Hit ${target.toLocaleString()} ${unit} → +${goalPoints} pts. Miss it → 0.`;
    return `Hit the daily goal → +${goalPoints} pts. Miss it → 0.`;
  }

  if (template.scoring_type === 'time_before' && targetTime) {
    const points = config.points ?? defaultNumber(template, 'points_on_time', 'points_for_success', 'points') ?? 3;
    return `By ${formatTime(targetTime)} → ${points} pts; late performance can score less.`;
  }

  if (template.scoring_type === 'threshold' && target !== undefined) {
    const points = config.points ?? defaultNumber(template, 'points_at_threshold', 'points_for_threshold', 'points') ?? 3;
    return `${target.toLocaleString()} ${unit} → ${points} pts; configured bonus applies beyond the goal.`;
  }

  if (template.scoring_type === 'linear_per_unit') {
    return 'Every extra unit can add points, up to the daily cap.';
  }

  if (template.scoring_type === 'tiered') return 'Your result lands in a scoring tier—the better tier earns more points.';
  return 'Points are based on the result you log.';
}
