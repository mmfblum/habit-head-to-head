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

export interface VerificationMetadata {
  verification_method?: 'manual_action' | 'auto_import' | 'timer_based';
  verified_at?: string;
  source?: 'manual' | 'apple_health' | 'google_fit' | 'screen_time' | 'whoop' | 'timer';
  confirmed?: boolean;
  manual_override?: boolean;
  admin_override?: boolean;
  override_reason?: string;
  bedtime_pressed_at?: string;
  wake_pressed_at?: string;
  duration_seconds?: number;
  timer_started_at?: string;
  timer_completed_at?: string;
  [key: string]: unknown;
}

export type VerificationStatus = 'verified' | 'flagged' | 'unverified';

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

// String-only labels used by the current check-in card.
export const DEFAULT_CONFIRMATION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CONFIRMATION_LABELS).map(([key, value]) => [key, value.label])
);

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
      : { wake_pressed_at: now }),
  };
}

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

/** Build metadata for a check-in while preserving audit fields from prior edits. */
export function buildVerifiedMetadata(
  source: VerificationMetadata['source'],
  confirmed: boolean,
  existingMetadata: VerificationMetadata = {}
): VerificationMetadata {
  const verificationMethod: VerificationMetadata['verification_method'] =
    source === 'timer'
      ? 'timer_based'
      : source && source !== 'manual'
        ? 'auto_import'
        : 'manual_action';

  return {
    ...existingMetadata,
    verification_method: verificationMethod,
    source,
    confirmed,
    verified_at: confirmed ? new Date().toISOString() : existingMetadata.verified_at,
  };
}

export function getVerificationStatus(
  metadata: Record<string, unknown> | null | undefined
): VerificationStatus {
  const meta = (metadata || {}) as VerificationMetadata;
  if (meta.manual_override && !meta.admin_override) return 'flagged';
  if (meta.admin_override || meta.confirmed) return 'verified';
  return 'unverified';
}

export function validateCheckinValue(
  inputType: string,
  value: {
    boolean_value?: boolean;
    numeric_value?: number;
    time_value?: string;
    duration_minutes?: number;
  },
  minValue?: number | null,
  maxValue?: number | null
): { valid: boolean; error?: string } {
  if (inputType === 'binary') {
    return typeof value.boolean_value === 'boolean'
      ? { valid: true }
      : { valid: false, error: 'Choose yes or no before confirming.' };
  }

  if (inputType === 'numeric') {
    const numeric = value.numeric_value;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
      return { valid: false, error: 'Enter a valid number.' };
    }
    if (minValue != null && numeric < minValue) {
      return { valid: false, error: `Value must be at least ${minValue}.` };
    }
    if (maxValue != null && numeric > maxValue) {
      return { valid: false, error: `Value must be no more than ${maxValue}.` };
    }
    return { valid: true };
  }

  if (inputType === 'time') {
    const time = value.time_value;
    return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      ? { valid: true }
      : { valid: false, error: 'Enter a valid time.' };
  }

  if (inputType === 'duration') {
    const minutes = value.duration_minutes;
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) {
      return { valid: false, error: 'Enter a valid duration.' };
    }
    if (minValue != null && minutes < minValue) {
      return { valid: false, error: `Duration must be at least ${minValue} minutes.` };
    }
    if (maxValue != null && minutes > maxValue) {
      return { valid: false, error: `Duration must be no more than ${maxValue} minutes.` };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Unsupported check-in type.' };
}

export function isCheckinVerified(
  metadata: Record<string, unknown> | null,
  verificationConfig: VerificationConfig | null
): boolean {
  if (!verificationConfig) return true;

  const meta = metadata as VerificationMetadata | null;
  if (meta?.admin_override) return true;
  if (verificationConfig.auto_import_only && meta?.source === 'manual') return false;
  if (verificationConfig.requires_confirmation && !meta?.confirmed) return false;
  return true;
}

export function getVerificationConfig(
  config: Record<string, unknown> | null
): VerificationConfig | null {
  if (!config?.verification) return null;
  return config.verification as VerificationConfig;
}

export function getTimeFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
