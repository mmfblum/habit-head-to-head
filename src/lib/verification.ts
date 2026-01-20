/**
 * Verification Layer for Task Check-ins
 * 
 * This module provides utilities for managing verification metadata on check-ins.
 * Verification ensures data integrity by requiring explicit user confirmation
 * for manual tasks and flagging auto-imported data sources.
 * 
 * RELIABILITY RULES:
 * 1. Each task has a verification method: manual_action, auto_import, timer_based
 * 2. Check-ins must have proper metadata to receive points
 * 3. Admin overrides bypass verification requirements
 * 4. Verification runs BEFORE scoring in the database trigger
 */

/**
 * Verification configuration stored in task_templates.default_config.verification
 */
export interface VerificationConfig {
  method: 'manual_action' | 'auto_import' | 'timer_based';
  allowed_sources: string[];
  requires_confirmation: boolean;
  manual_requires_flag: boolean;
  confirmation_action: string | null;
  auto_import_only?: boolean;
  captures_timestamp?: boolean;
  min_duration_seconds?: number;
  description: string;
}

/**
 * Verification metadata stored in daily_checkins.metadata
 */
export interface VerificationMetadata {
  verification_method?: 'manual_action' | 'auto_import' | 'timer_based';
  verified_at?: string;
  source?: 'manual' | 'apple_health' | 'google_fit' | 'screen_time' | 'whoop' | 'timer';
  confirmed?: boolean;
  manual_override?: boolean;
  admin_override?: boolean;
  override_reason?: string;
  // Time-based tasks
  bedtime_pressed_at?: string;
  wake_pressed_at?: string;
  // Timer-based tasks
  duration_seconds?: number;
  timer_started_at?: string;
  timer_completed_at?: string;
  [key: string]: unknown;
}

/**
 * Confirmation action labels for UI buttons
 */
export const CONFIRMATION_LABELS: Record<string, { label: string; icon: string }> = {
  complete_workout: { label: 'Complete Workout', icon: '💪' },
  complete_pushups: { label: 'Complete Pushups', icon: '🏋️' },
  finish_reading: { label: 'Finished Reading', icon: '📚' },
  complete_practice: { label: 'Practice Completed', icon: '🎯' },
  complete_journaling: { label: 'Done Journaling', icon: '📝' },
  complete_meditation: { label: 'Meditation Complete', icon: '🧘' },
  going_to_bed: { label: 'Going to Bed', icon: '🌙' },
  im_awake: { label: "I'm Awake", icon: '☀️' },
  log_water: { label: 'Log Water', icon: '💧' },
};

/**
 * Creates verification metadata for a manual check-in with confirmation
 */
export function createConfirmedMetadata(
  existingMetadata?: Record<string, unknown>
): VerificationMetadata {
  return {
    ...(existingMetadata as VerificationMetadata),
    verification_method: 'manual_action',
    verified_at: new Date().toISOString(),
    source: 'manual',
    confirmed: true,
  };
}

/**
 * Creates verification metadata for a time-capture action (bedtime/wake)
 */
export function createTimeCaptureMetadata(
  actionType: 'bedtime' | 'wake',
  existingMetadata?: Record<string, unknown>
): VerificationMetadata {
  const now = new Date().toISOString();
  return {
    ...(existingMetadata as VerificationMetadata),
    verification_method: 'manual_action',
    verified_at: now,
    source: 'manual',
    confirmed: true,
    ...(actionType === 'bedtime' 
      ? { bedtime_pressed_at: now }
      : { wake_pressed_at: now }
    ),
  };
}

/**
 * Creates verification metadata for timer-based completion
 */
export function createTimerMetadata(
  durationSeconds: number,
  timerStartedAt: string,
  existingMetadata?: Record<string, unknown>
): VerificationMetadata {
  return {
    ...(existingMetadata as VerificationMetadata),
    verification_method: 'timer_based',
    verified_at: new Date().toISOString(),
    source: 'timer',
    confirmed: true,
    duration_seconds: durationSeconds,
    timer_started_at: timerStartedAt,
    timer_completed_at: new Date().toISOString(),
  };
}

/**
 * Creates verification metadata for auto-imported data
 */
export function createAutoImportMetadata(
  source: 'apple_health' | 'google_fit' | 'screen_time' | 'whoop',
  existingMetadata?: Record<string, unknown>
): VerificationMetadata {
  return {
    ...(existingMetadata as VerificationMetadata),
    verification_method: 'auto_import',
    verified_at: new Date().toISOString(),
    source,
    confirmed: true,
  };
}

/**
 * Creates verification metadata for manual entry on auto-import tasks
 * (Flagged for potential review)
 */
export function createFlaggedManualMetadata(
  existingMetadata?: Record<string, unknown>
): VerificationMetadata {
  return {
    ...(existingMetadata as VerificationMetadata),
    verification_method: 'manual_action',
    verified_at: new Date().toISOString(),
    source: 'manual',
    confirmed: true,
    manual_override: true,
  };
}

/**
 * Checks if a check-in is verified based on its metadata
 */
export function isCheckinVerified(
  metadata: Record<string, unknown> | null,
  verificationConfig: VerificationConfig | null
): boolean {
  // No verification config = allow (backwards compatibility)
  if (!verificationConfig) return true;
  
  const meta = metadata as VerificationMetadata | null;
  
  // Admin override always allows
  if (meta?.admin_override) return true;
  
  // Auto-import only tasks reject manual source
  if (verificationConfig.auto_import_only && meta?.source === 'manual') {
    return false;
  }
  
  // Confirmation required tasks need confirmed = true
  if (verificationConfig.requires_confirmation && !meta?.confirmed) {
    return false;
  }
  
  return true;
}

/**
 * Extracts verification config from task config
 */
export function getVerificationConfig(
  config: Record<string, unknown> | null
): VerificationConfig | null {
  if (!config?.verification) return null;
  return config.verification as VerificationConfig;
}

/**
 * Gets the time value from a timestamp capture
 */
export function getTimeFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
