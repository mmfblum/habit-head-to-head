import { TaskTemplate } from '@/hooks/useTaskTemplates';

export interface TaskConfigForNaming {
  scoring_mode?: 'binary' | 'detailed';
  target?: number;
  threshold?: number;
  target_time?: string;
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function unitLabel(template: TaskTemplate, value?: number): string {
  const n = typeof value === 'number' ? value : undefined;

  switch (template.unit) {
    case 'minutes':
      return 'min';
    case 'hours':
      return n === 1 ? 'hour' : 'hours';
    case 'steps':
      return 'steps';
    case 'pages':
      return n === 1 ? 'page' : 'pages';
    case 'words':
      return n === 1 ? 'word' : 'words';
    case 'miles':
      return n === 1 ? 'mile' : 'miles';
    case 'calories':
      return 'cal';
    case 'count':
      // Many “count” tasks are naturally “times”
      return n === 1 ? 'time' : 'times';
    default:
      return '';
  }
}

function normalizeBaseName(template: TaskTemplate): string {
  const name = template.name?.trim() ?? '';

  // Make common time-task names read naturally
  if (template.unit === 'waketime_time') return 'Wake up';
  if (template.unit === 'bedtime_time') return 'Be in bed';

  return name;
}

/**
 * Produces a short, user-friendly label for a configured task.
 *
 * Examples:
 * - "Meditation — 10 min"
 * - "Steps — 8000 steps"
 * - "Wake up by 6:30 AM"
 * - "Be in bed by 10:45 PM"
 */
export function getConfiguredTaskName(
  template: TaskTemplate,
  config: TaskConfigForNaming
): string {
  const baseName = normalizeBaseName(template);

  // Time-based tasks show the target time
  if (
    config.target_time &&
    (template.unit === 'bedtime_time' || template.unit === 'waketime_time')
  ) {
    return `${baseName} by ${formatTime(config.target_time)}`;
  }

  // Prefer target, fallback to threshold
  const value =
    typeof config.target === 'number' && config.target > 0
      ? config.target
      : typeof config.threshold === 'number' && config.threshold > 0
        ? config.threshold
        : undefined;

  if (typeof value === 'number') {
    const u = unitLabel(template, value);

    // If we have a unit, show "Name — value unit"
    if (u) return `${baseName} — ${value} ${u}`;

    // Otherwise show "Name — value"
    return `${baseName} — ${value}`;
  }

  return baseName;
}
