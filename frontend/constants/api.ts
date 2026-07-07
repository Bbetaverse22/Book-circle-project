import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getDeviceId } from '../utils/deviceId';

function getDevServerHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoClient?.hostUri;

  if (!hostUri) return null;
  return hostUri.split(':')[0];
}

export function getApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;

  if (configured && configured !== 'http://localhost:3000') {
    return configured;
  }

  const devHost = getDevServerHost();
  if (devHost) {
    return `http://${devHost}:3000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return configured ?? 'http://localhost:3000';
}

export const API_URL = getApiUrl();

// ── Authenticated fetch ──────────────────────────────────────────────────────

export interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  isSubscriber: boolean;
}

// Thrown when the backend answers 402 — the device is out of free questions.
export class LimitReachedError extends Error {
  usage?: UsageInfo;

  constructor(message: string, usage?: UsageInfo) {
    super(message);
    this.name = 'LimitReachedError';
    this.usage = usage;
  }
}

// fetch wrapper that attaches the anonymous device identity the backend
// requires, and converts 402 quota responses into LimitReachedError.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const deviceId = await getDeviceId();
  const headers = new Headers(init.headers);
  headers.set('X-Device-Id', deviceId);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (response.status === 402) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; usage?: UsageInfo }
      | null;
    throw new LimitReachedError(body?.error ?? 'Daily limit reached', body?.usage);
  }

  return response;
}
