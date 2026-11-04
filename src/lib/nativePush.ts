import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type ActionPerformed,
  type PermissionState,
  type PluginListenerHandle,
} from '@capacitor/push-notifications';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const TOKEN_STORAGE_KEY = 'zrizin:native-push-token';
const pushDb = supabase as unknown as SupabaseClient;

type NativePlatform = 'ios' | 'android';

interface StoredPushToken {
  platform: NativePlatform;
  token: string;
}

function getNativePlatform(): NativePlatform | null {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : null;
}

function getStoredPushToken(): StoredPushToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPushToken;
    if ((parsed.platform !== 'ios' && parsed.platform !== 'android') || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storePushToken(value: StoredPushToken) {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(value));
}

async function persistPushToken(token: string) {
  const platform = getNativePlatform();
  if (!platform || !token) return;

  const { error } = await pushDb.rpc('register_push_token', {
    _platform: platform,
    _token: token,
  });

  if (error) throw error;
  storePushToken({ platform, token });
}

function getSafeNotificationPath(action: ActionPerformed): string | null {
  const data = action.notification?.data as Record<string, unknown> | undefined;
  const candidate = typeof data?.path === 'string'
    ? data.path
    : typeof data?.route === 'string'
      ? data.route
      : null;

  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return null;

  const allowedRoots = ['/', '/tasks', '/league', '/matchup', '/feed', '/notifications', '/profile'];
  const pathname = candidate.split(/[?#]/, 1)[0];
  return allowedRoots.includes(pathname) ? candidate : null;
}

export function isNativePushAvailable() {
  return Capacitor.isNativePlatform() && getNativePlatform() !== null;
}

export async function getNativePushPermission(): Promise<PermissionState | 'unavailable'> {
  if (!isNativePushAvailable()) return 'unavailable';
  const status = await PushNotifications.checkPermissions();
  return status.receive;
}

export async function registerNativePush() {
  if (!isNativePushAvailable()) return;
  await PushNotifications.register();
}

export async function requestNativePushPermission(): Promise<PermissionState | 'unavailable'> {
  if (!isNativePushAvailable()) return 'unavailable';

  let status = await PushNotifications.checkPermissions();
  if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
    status = await PushNotifications.requestPermissions();
  }

  if (status.receive === 'granted') {
    await registerNativePush();
  }

  return status.receive;
}

export async function startNativePushListeners(
  onRegistrationError?: (message: string) => void,
): Promise<() => Promise<void>> {
  if (!isNativePushAvailable()) return async () => undefined;

  const handles: PluginListenerHandle[] = [];

  handles.push(await PushNotifications.addListener('registration', async (token) => {
    try {
      await persistPushToken(token.value);
    } catch (error) {
      console.error('Failed to save native push token', error);
      onRegistrationError?.('Push registration could not be saved.');
    }
  }));

  handles.push(await PushNotifications.addListener('registrationError', (error) => {
    console.error('Native push registration failed', error.error);
    onRegistrationError?.(error.error || 'Push registration failed.');
  }));

  handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const path = getSafeNotificationPath(action);
    if (!path || typeof window === 'undefined') return;
    window.location.assign(path);
  }));

  return async () => {
    await Promise.all(handles.map((handle) => handle.remove()));
  };
}

export async function disableNativePushForCurrentUser() {
  if (!isNativePushAvailable()) return;

  const stored = getStoredPushToken();
  if (stored) {
    const { error } = await pushDb.rpc('unregister_push_token', {
      _platform: stored.platform,
      _token: stored.token,
    });
    if (error) console.warn('Failed to disable stored push token', error);
  }

  try {
    await PushNotifications.unregister();
  } catch (error) {
    console.warn('Failed to unregister native push token from the platform', error);
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
