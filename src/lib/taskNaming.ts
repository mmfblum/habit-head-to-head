import { TaskTemplate } from '@/hooks/useTaskTemplates';

export interface TaskConfigForNaming {
  scoring_mode?: 'binary' | 'detailed';
  target?: number;
  threshold?: number;
  target_time?: string;
}

function getUnitLabel(template: TaskTemplate): string {
  switch (template.unit) {
    case 'minutes':
      return 'min';
    case 'steps':
      return 'steps';
    case 'count':
      return template.name.toLowerCase().includes('meal') ? 'meals' : 'times';
    case 'hours':
      return 'hours';
    case 'pages':
      return 'pages';
    case 'words':
      return 'words';
    case 'miles':
      return 'miles';
    case 'calories':
      return 'cal';
    default:
      return '';
  }
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function getConfiguredTaskName(
  template: TaskTemplate, 
  config: TaskConfigForNaming
): string {
  const baseName = template.name;
  const unit = getUnitLabel(template);

  // Time-based tasks show the target time
  if (config.target_time && (template.unit === 'bedtime_time' || template.unit === 'waketime_time')) {
    return `${baseName} by ${formatTime(config.target_time)}`;
  }

  // For tasks with a target/threshold, show the value
  if (config.target && config.target > 0 && unit) {
    return `${config.target} ${unit} of ${baseName}`;
  }

  if (config.threshold && config.threshold > 0 && unit) {
    return `${config.threshold} ${unit} of ${baseName}`;
  }

  return baseName;
}
