import { describe, expect, it } from 'vitest';
import { getConfiguredTaskName, getTaskScoringSentence } from '@/lib/taskNaming';
import type { TaskTemplate } from '@/hooks/useTaskTemplates';

function template(overrides: Partial<TaskTemplate>): TaskTemplate {
  return {
    id: 'template-1',
    name: 'Daily Steps',
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
    supports_integration: true,
    allowed_data_sources: ['manual'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('plain-English task scoring', () => {
  it('uses the commissioner-provided custom challenge name', () => {
    const custom = template({
      name: 'Custom Challenge — Minutes',
      category: 'custom',
      input_type: 'duration',
      unit: 'minutes',
      scoring_type: 'threshold',
      default_config: { threshold: 20 },
    });

    expect(getConfiguredTaskName(custom, {
      scoring_mode: 'binary',
      custom_name: 'Daily Religious Study',
      threshold: 30,
      binary_points: 3,
    })).toBe('Daily Religious Study');
  });

  it('explains equal-weight goal scoring without engine terminology', () => {
    const steps = template({});
    expect(getTaskScoringSentence(steps, {
      scoring_mode: 'binary',
      target: 10000,
      binary_points: 3,
    })).toBe('Hit 10,000 steps → +3 pts. Miss it → 0.');
  });

  it('explains a simple checkoff challenge', () => {
    const challenge = template({
      name: 'Custom Challenge — Checkoff',
      category: 'custom',
      input_type: 'binary',
      unit: 'boolean',
      scoring_type: 'binary_yesno',
      default_config: {},
    });

    expect(getTaskScoringSentence(challenge, {
      scoring_mode: 'binary',
      custom_name: 'No Dessert',
      binary_points: 3,
    })).toBe('Complete it → +3 pts. Miss it → 0.');
  });
});
