import { describe, expect, it } from 'vitest';
import { getTaskGoalTarget, isTaskGoalMet } from '@/lib/taskProgress';
import type { TaskWithTemplate } from '@/types/checkin';

function task(overrides: Partial<TaskWithTemplate>): TaskWithTemplate {
  return {
    id: 'task-1',
    season_id: 'season-1',
    league_task_config_id: 'config-1',
    user_custom_task_id: null,
    task_name: 'Task',
    input_type: 'numeric',
    scoring_type: 'threshold',
    config: {},
    created_at: new Date().toISOString(),
    template: undefined,
    todayCheckin: undefined,
    ...overrides,
  } as TaskWithTemplate;
}

describe('task goal evaluation', () => {
  it('treats Screen Time as lower-is-better', () => {
    const underLimit = task({
      task_name: 'Screen Time',
      input_type: 'numeric',
      scoring_type: 'tiered',
      config: { daily_limit_minutes: 120, target: 120 },
      todayCheckin: {
        id: 'checkin-1',
        user_id: 'user-1',
        task_instance_id: 'task-1',
        checkin_date: '2026-08-11',
        numeric_value: 90,
        boolean_value: null,
        time_value: null,
        duration_minutes: null,
        metadata: {},
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    expect(getTaskGoalTarget(underLimit)).toBe(120);
    expect(isTaskGoalMet(underLimit)).toBe(true);
    expect(isTaskGoalMet({
      ...underLimit,
      todayCheckin: { ...underLimit.todayCheckin!, numeric_value: 150 },
    })).toBe(false);
  });

  it('treats a normal numeric target as value-at-or-above goal', () => {
    const steps = task({
      task_name: 'Steps',
      input_type: 'numeric',
      scoring_type: 'linear_per_unit',
      config: { target: 10000 },
      todayCheckin: {
        id: 'checkin-2',
        user_id: 'user-1',
        task_instance_id: 'task-1',
        checkin_date: '2026-08-11',
        numeric_value: 10000,
        boolean_value: null,
        time_value: null,
        duration_minutes: null,
        metadata: {},
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    expect(isTaskGoalMet(steps)).toBe(true);
  });

  it('does not count after-midnight bedtime as before an evening target', () => {
    const bedtime = task({
      task_name: 'Bedtime',
      input_type: 'time',
      scoring_type: 'time_before',
      config: { target_time: '23:00' },
      todayCheckin: {
        id: 'checkin-3',
        user_id: 'user-1',
        task_instance_id: 'task-1',
        checkin_date: '2026-08-11',
        numeric_value: null,
        boolean_value: null,
        time_value: '00:30:00',
        duration_minutes: null,
        metadata: {},
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    expect(isTaskGoalMet(bedtime)).toBe(false);
  });

  it('counts an early wake time as meeting a morning deadline', () => {
    const wake = task({
      task_name: 'Wake Time',
      input_type: 'time',
      scoring_type: 'time_before',
      config: { target_time: '06:30' },
      todayCheckin: {
        id: 'checkin-4',
        user_id: 'user-1',
        task_instance_id: 'task-1',
        checkin_date: '2026-08-11',
        numeric_value: null,
        boolean_value: null,
        time_value: '06:00:00',
        duration_minutes: null,
        metadata: {},
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    expect(isTaskGoalMet(wake)).toBe(true);
  });
});
