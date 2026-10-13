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

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function defaultNumber(template: TaskTemplate, ...keys: string[]): number | undefined {
  const defaults = (template.default_config || {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = defaults[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function friendlyDuration(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hr${hours === 1 ? '' : 's'}`;
  }
  return `${formatAmount(minutes)} min`;
}

/**
 * Task titles are deliberately phrased as the actual ask.
 * A player should understand the goal from the title without opening details.
 */
export function getConfiguredTaskName(template: TaskTemplate, config: TaskConfigForNaming): string {
  const customName = config.custom_name?.trim();
  const baseName = customName || template.name;
  const targetTime = config.target_time
    ?? ((template.default_config as Record<string, unknown> | null)?.target_time as string | undefined);

  if (targetTime && (template.unit === 'bedtime_time' || template.unit === 'waketime_time')) {
    if (template.unit === 'waketime_time') return `Wake by ${formatTime(targetTime)}`;
    return `Bed by ${formatTime(targetTime)}`;
  }

  const dailyLimit = config.daily_limit_minutes
    ?? defaultNumber(template, 'daily_limit_minutes');
  if (dailyLimit !== undefined && dailyLimit > 0) {
    if (template.name === 'Screen Time') return `Screen Time ≤ ${friendlyDuration(dailyLimit)}`;
    return `${baseName} ≤ ${friendlyDuration(dailyLimit)}`;
  }

  const target = config.target ?? config.threshold
    ?? defaultNumber(template, 'target', 'threshold');

  if (target === undefined || target <= 0) {
    if (customName) return customName;
    switch (template.name) {
      case 'Something New': return 'Do Something New';
      case 'Healthy Eating': return 'No Junk Food Today';
      case 'Stopped Eating After 8 PM': return 'No Eating After 8 PM';
      case 'Journaling': return 'Journal Today';
      default: return baseName;
    }
  }

  const amount = formatAmount(target);

  if (customName) {
    switch (template.unit) {
      case 'count': return `${amount} ${customName}`;
      case 'minutes': return `${friendlyDuration(target)} ${customName}`;
      case 'hours': return `${amount} hr ${customName}`;
      case 'pages': return `${amount} pages ${customName}`;
      default: return `${amount} ${customName}`;
    }
  }

  switch (template.name) {
    case 'Pushups': return `${amount} Pushups`;
    case 'Steps': return `${amount} Steps`;
    case 'Workout': return `${friendlyDuration(target)} Workout`;
    case 'Run / Walk': return `${friendlyDuration(target)} Run / Walk`;
    case 'Stretching': return `${friendlyDuration(target)} Stretching`;
    case 'Outside Time': return `${friendlyDuration(target)} Outside`;
    case 'Learning Time': return `${friendlyDuration(target)} Learning`;
    case 'Reading': return `Read ${amount} pages`;
    case 'Skill Practice': return `${friendlyDuration(target)} Skill Practice`;
    case 'Deep Work': return `${friendlyDuration(target)} Deep Work`;
    case 'Sleep Duration': return `Sleep ${amount} hr${target === 1 ? '' : 's'}`;
    case 'Water Intake': return `Drink ${amount} glasses of water`;
    case 'Meditation': return `${friendlyDuration(target)} Meditation`;
    case 'Connection Time': return `${friendlyDuration(target)} Connection Time`;
    default:
      switch (template.unit) {
        case 'count': return `${amount} ${baseName}`;
        case 'steps': return `${amount} Steps`;
        case 'minutes': return `${friendlyDuration(target)} ${baseName}`;
        case 'hours': return `${amount} hr ${baseName}`;
        case 'pages': return `${amount} pages ${baseName}`;
        case 'words': return `${amount} words ${baseName}`;
        case 'miles': return `${amount} mi ${baseName}`;
        default: return `${amount} ${baseName}`;
      }
  }
}

export function getTaskScoringSentence(template: TaskTemplate, config: TaskConfigForNaming): string {
  const title = getConfiguredTaskName(template, config);
  return `Complete “${title}” → +1 point. Miss it → 0.`;
}
