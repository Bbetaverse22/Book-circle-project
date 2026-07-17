// Subscription entitlement checks via the RevenueCat REST API.
//
// The app identifies users by anonymous device ID; RevenueCat is configured
// (in the mobile app) to log in with that same device ID, so the backend can
// look up subscription status server-side without user accounts.
//
// When REVENUECAT_API_KEY is not set, everyone is treated as free tier.

import { ENTITLEMENT_ID } from '../config';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  isSubscriber: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function isSubscriber(deviceId: string): Promise<boolean> {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) return false;

  const cached = cache.get(deviceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isSubscriber;
  }

  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(deviceId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!res.ok) {
      // Unknown subscriber (404) or transient error — treat as free tier,
      // but only cache definitive answers.
      if (res.status === 404) {
        cache.set(deviceId, { isSubscriber: false, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return false;
    }

    const data = (await res.json()) as {
      subscriber?: {
        entitlements?: Record<string, { expires_date: string | null }>;
      };
    };

    const entitlement = data.subscriber?.entitlements?.[ENTITLEMENT_ID];
    const active =
      !!entitlement &&
      (entitlement.expires_date === null ||
        new Date(entitlement.expires_date).getTime() > Date.now());

    cache.set(deviceId, { isSubscriber: active, expiresAt: Date.now() + CACHE_TTL_MS });
    return active;
  } catch (error) {
    console.warn('RevenueCat entitlement check failed:', error);
    return cached?.isSubscriber ?? false;
  }
}
