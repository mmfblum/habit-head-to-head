import { Capacitor } from '@capacitor/core';

function normalizeOrigin(value: string) {
  return value.replace(/\/+$/, '');
}

export function getPublicAppOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (configured) return normalizeOrigin(configured);

  if (!Capacitor.isNativePlatform() && typeof window !== 'undefined') {
    return normalizeOrigin(window.location.origin);
  }

  throw new Error('Public sharing is not configured for this native build yet. Set VITE_PUBLIC_APP_URL to the deployed Zrizin web URL.');
}

export function getPublicAppUrl(path = '/') {
  const origin = getPublicAppOrigin();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}
