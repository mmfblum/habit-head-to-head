import { Capacitor, registerPlugin } from '@capacitor/core';

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

export interface ZrizinNativeHealthBridge {
  platform: NativeHealthPlatform;
  requestAuthorization(metrics: HealthMetric[]): Promise<HealthAuthorizationResult>;
  readDailySnapshot(date: string): Promise<DailyHealthSnapshot>;
  openScreenTimeSettings?(): Promise<void>;
}

interface NativeHealthPlugin {
  requestAuthorization(options: { metrics: HealthMetric[] }): Promise<HealthAuthorizationResult>;
  readDailySnapshot(options: { date: string }): Promise<DailyHealthSnapshot>;
  openScreenTimeSettings(): Promise<void>;
}

const CapacitorHealth = registerPlugin<NativeHealthPlugin>('ZrizinHealth');

declare global {
  interface Window {
    // Kept as an injected fallback for local native prototypes and tests. Real
    // Capacitor builds use the registered ZrizinHealth plugin above.
    ZrizinHealth?: ZrizinNativeHealthBridge;
  }
}

function getInjectedBridge(): ZrizinNativeHealthBridge | null {
  if (typeof window === 'undefined') return null;
  return window.ZrizinHealth ?? null;
}

export function getNativeHealthBridge(): ZrizinNativeHealthBridge | null {
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios' || platform === 'android') {
      return {
        platform,
        requestAuthorization: (metrics) => CapacitorHealth.requestAuthorization({ metrics }),
        readDailySnapshot: (date) => CapacitorHealth.readDailySnapshot({ date }),
        openScreenTimeSettings: platform === 'android'
          ? () => CapacitorHealth.openScreenTimeSettings()
          : undefined,
      };
    }
  }

  return getInjectedBridge();
}

export function hasNativeHealthBridge(): boolean {
  return getNativeHealthBridge() !== null;
}

export function getHealthIntegrationLabel(): string {
  const bridge = getNativeHealthBridge();
  if (!bridge) return 'Manual tracking on web';
  return bridge.platform === 'ios' ? 'Apple Health available' : 'Health Connect + Usage Access available';
}
