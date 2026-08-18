import type { CheckinValue, TaskWithTemplate } from '@/types/checkin';

function asConfig(task: TaskWithTemplate): Record<string, unknown> {
  return (task.config || {}) as Record<string, unknown>;
}

function numericConfig(config: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function timeToMinutes(value?: string | null): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function getTaskGoalTarget(task: TaskWithTemplate): number {
  const config = asConfig(task);
  return numericConfig(
    config,
    'daily_limit_minutes',
    'target',
    'threshold'
  ) ?? 1;
}

/**
 * Convert a one-tap Done/Missed choice into a valid raw check-in value.
 * This keeps manually scored integration tasks on the same scoring engine as
 * exact/manual and future device-import values.
 */
export function getManualGoalCheckinValue(
  task: TaskWithTemplate,
  hitGoal: boolean
): CheckinValue | null {
  const config = asConfig(task);
  const dailyLimit = numericConfig(config, 'daily_limit_minutes');
  const target = dailyLimit ?? numericConfig(config, 'target', 'threshold');
  if (target === undefined) return null;

  const missStep = Math.max(1, numericConfig(config, 'unit_size') ?? 1);
  const rawValue = hitGoal
    ? target
    : dailyLimit !== undefined
      ? target + missStep
      : 0;

  if (task.input_type === 'duration') return { duration_minutes: rawValue };
  if (task.input_type === 'numeric') return { numeric_value: rawValue };
  return null;
}

export function isTaskGoalMet(task: TaskWithTemplate): boolean {
  const checkin = task.todayCheckin;
  if (!checkin) return false;

  const config = asConfig(task);

  if (task.input_type === 'binary') {
    return checkin.boolean_value === true;
  }

  if (task.input_type === 'time') {
    const actualMinutes = timeToMinutes(checkin.time_value);
    const targetMinutes = timeToMinutes(
      typeof config.target_time === 'string' ? config.target_time : undefined
    );

    if (actualMinutes === null) return false;
    if (targetMinutes === null) return true;

    if (task.scoring_type === 'time_after') {
      return actualMinutes >= targetMinutes;
    }

    // Evening deadlines treat after-midnight values as late rather than early.
    if (targetMinutes >= 12 * 60 && actualMinutes < 12 * 60) {
      return false;
    }

    return actualMinutes <= targetMinutes;
  }

  const actual = task.input_type === 'duration'
    ? checkin.duration_minutes
    : checkin.numeric_value;

  if (actual === null || actual === undefined) return false;

  const dailyLimit = numericConfig(config, 'daily_limit_minutes');
  if (dailyLimit !== undefined) {
    return actual <= dailyLimit;
  }

  const target = numericConfig(config, 'target', 'threshold');
  if (target === undefined) return true;
  return actual >= target;
}
