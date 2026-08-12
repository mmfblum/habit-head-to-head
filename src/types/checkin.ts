// Types for daily check-in system
import type { Tables, Enums } from '@/integrations/supabase/types';

export type TaskTemplate = Tables<'task_templates'>;
export type TaskInstance = Tables<'task_instances'>;
export type DailyCheckin = Tables<'daily_checkins'>;

export type InputType = Enums<'input_type'>;
export type ScoringType = Enums<'scoring_type'>;
export type UnitType = Enums<'unit_type'>;

export interface TaskWithTemplate extends TaskInstance {
  template?: TaskTemplate;
  todayCheckin?: DailyCheckin;
}

export interface CheckinValue {
  boolean_value?: boolean;
  numeric_value?: number;
  time_value?: string;
  duration_minutes?: number;
  metadata?: Record<string, unknown> | null;
}

export const TASK_ICONS: Record<string, string> = {
  footprints: '👟',
  dumbbell: '💪',
  'chevrons-up': '⬆️',
  'book-open': '📚',
  target: '🎯',
  smartphone: '📱',
  pencil: '📝',
  brain: '🧘',
  moon: '🌙',
  sun: '☀️',
  activity: '📊',
  droplet: '💧',
  timer: '⏱️',
  sparkles: '✨',
  hash: '🔢',
};
