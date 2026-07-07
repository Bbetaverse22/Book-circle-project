import * as Crypto from 'expo-crypto';
import { kvGet, kvSet } from './kvStore';

const DEVICE_ID_KEY = 'bookcircle_device_id';

let cached: string | null = null;
let pending: Promise<string> | null = null;

// Anonymous per-install identity. The backend uses it for daily usage quotas
// and RevenueCat uses it as the app user ID, so subscriptions work without
// accounts. Stored in SecureStore so it survives app restarts.
export function getDeviceId(): Promise<string> {
  if (cached) return Promise.resolve(cached);
  if (pending) return pending;

  pending = (async () => {
    let id = await kvGet(DEVICE_ID_KEY);
    if (!id) {
      id = Crypto.randomUUID();
      await kvSet(DEVICE_ID_KEY, id);
    }
    cached = id;
    return id;
  })();

  return pending;
}
