export type HealthMetric = 'steps' | 'workouts' | 'screen_time_minutes';
export type NativeHealthPlatform = 'ios' | 'android';
export type NativeHealthSource = 'apple_health' | 'health_connect' | 'screen_time' | 'android_usage';

export interface WorkoutSample {
  id: string;
  activity: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  distanceMiles?: number;
}

export interface DailyHealthSnapshot {
  date: string;
  steps?: number;
  workoutMinutes?: number;
  workouts?: WorkoutSample[];
  screenTimeMinutes?: number;
  sources: NativeHealthSource[];
}

export interface HealthAuthorizationResult {
  granted: HealthMetric[];
  denied: HealthMetric[];
}

/**
 * Contract implemented by a future native iOS/Android shell (for example via a
 * Capacitor plugin). The web/PWA build intentionally does not pretend it can
 * read protected device health or screen-time stores directly.
 */
export interface ZrizinNativeHealthBridge {
  platform: NativeHealthPlatform;
  requestAuthorization(metrics: HealthMetric[]): Promise<HealthAuthorizationResult>;
  readDailySnapshot(date: string): Promise<DailyHealthSnapshot>;
}

declare global {
  interface Window {
    ZrizinHealth?: ZrizinNativeHealthBridge;
  }
}

export function getNativeHealthBridge(): ZrizinNativeHealthBridge | null {
  if (typeof window === 'undefined') return null;
  return window.ZrizinHealth ?? null;
}

export function hasNativeHealthBridge(): boolean {
  return getNativeHealthBridge() !== null;
}

export function getHealthIntegrationLabel(): string {
  const bridge = getNativeHealthBridge();
  if (!bridge) return 'Manual tracking on web';
  return bridge.platform === 'ios' ? 'Apple Health ready' : 'Health Connect ready';
}
