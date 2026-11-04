import { describe, expect, it } from 'vitest';
import { getConfiguredTaskName, getTaskScoringSentence } from '@/lib/taskNaming';
import type { TaskTemplate } from '@/hooks/useTaskTemplates';

function template(overrides: Partial<TaskTemplate>): TaskTemplate {
  return {
    id: 'template-1',
    name: 'Steps',
    description: null,
    category: 'fitness',
    icon: 'footprints',
    input_type: 'numeric',
    unit: 'steps',
    scoring_type: 'linear_per_unit',
    default_config: { target: 10000 },
    min_value: 0,
    max_value: 50000,
    is_active: true,
    is_premium: false,
    version: 1,
    supports_integration: false,
    allowed_data_sources: ['manual'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('player-facing task names', () => {
  const cases: Array<{
    name: string;
    template: Partial<TaskTemplate>;
    config: Record<string, unknown>;
    expected: string;
  }> = [
    {
      name: 'pushups',
      template: { name: 'Pushups', unit: 'count', input_type: 'numeric' },
      config: { target: 30 },
      expected: '30 Pushups',
    },
    {
      name: 'steps',
      template: { name: 'Steps', unit: 'steps', input_type: 'numeric' },
      config: { target: 10000 },
      expected: '10,000 Steps',
    },
    {
      name: 'workout',
      template: { name: 'Workout', unit: 'minutes', input_type: 'duration' },
      config: { threshold: 30 },
      expected: '30 min Workout',
    },
    {
      name: 'reading',
      template: { name: 'Reading', unit: 'pages', input_type: 'numeric' },
      config: { target: 20 },
      expected: 'Read 20 pages',
    },
    {
      name: 'screen time',
      template: { name: 'Screen Time', unit: 'minutes', input_type: 'numeric' },
      config: { daily_limit_minutes: 120 },
      expected: 'Screen Time ≤ 2 hrs',
    },
    {
      name: 'sleep duration',
      template: { name: 'Sleep Duration', unit: 'hours', input_type: 'numeric' },
      config: { threshold: 7 },
      expected: 'Sleep 7 hrs',
    },
    {
      name: 'water',
      template: { name: 'Water Intake', unit: 'count', input_type: 'numeric' },
      config: { threshold: 8 },
      expected: 'Drink 8 glasses of water',
    },
    {
      name: 'wake time',
      template: { name: 'Wake Time', unit: 'waketime_time', input_type: 'time', scoring_type: 'time_before' },
      config: { target_time: '06:30' },
      expected: 'Wake by 6:30 AM',
    },
    {
      name: 'bedtime',
      template: { name: 'Bedtime', unit: 'bedtime_time', input_type: 'time', scoring_type: 'time_before' },
      config: { target_time: '23:00' },
      expected: 'Bed by 11:00 PM',
    },
    {
      name: 'custom reps',
      template: { name: 'Custom Challenge — Count', unit: 'count', input_type: 'numeric', category: 'custom' },
      config: { custom_name: 'Pullups', threshold: 12 },
      expected: '12 Pullups',
    },
  ];

  cases.forEach((testCase) => {
    it(`shows the actual ask for ${testCase.name}`, () => {
      expect(getConfiguredTaskName(
        template(testCase.template),
        { scoring_mode: 'binary', binary_points: 1, ...testCase.config }
      )).toBe(testCase.expected);
    });
  });

  it('always explains the one-point rule', () => {
    const steps = template({ name: 'Steps' });
    expect(getTaskScoringSentence(steps, {
      scoring_mode: 'binary',
      target: 10000,
      binary_points: 1,
    })).toBe('Complete “10,000 Steps” → +1 point. Miss it → 0.');
  });
});
