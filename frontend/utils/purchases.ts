// Thin wrapper around react-native-purchases (RevenueCat).
//
// The native module only exists in dev/production builds (EAS), not in
// Expo Go or on web — so it is loaded lazily and every call degrades to a
// safe no-op when unavailable. The paywall shows a notice in that case.

import { Platform } from 'react-native';
import { getDeviceId } from './deviceId';

export interface SubscriptionPackage {
  identifier: string;
  priceString: string;
  title: string;
  // Opaque RevenueCat package handed back to purchase().
  rcPackage: unknown;
}

const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ?? 'premium';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Purchases: any = null;
let configured = false;

function loadModule(): boolean {
  if (Purchases) return true;
  if (Platform.OS === 'web') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Purchases = require('react-native-purchases').default;
    return true;
  } catch {
    return false; // Expo Go — native module not linked
  }
}

export function purchasesAvailable(): boolean {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  return !!apiKey && loadModule();
}

async function ensureConfigured(): Promise<boolean> {
  if (!purchasesAvailable()) return false;
  if (configured) return true;

  const deviceId = await getDeviceId();
  Purchases.configure({
    apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    // Same anonymous ID the backend uses for quotas, so server-side
    // entitlement checks line up with purchases automatically.
    appUserID: deviceId,
  });
  configured = true;
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasEntitlement(customerInfo: any): boolean {
  return !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
}

export async function checkIsSubscriber(): Promise<boolean> {
  if (!(await ensureConfigured())) return false;
  try {
    return hasEntitlement(await Purchases.getCustomerInfo());
  } catch {
    return false;
  }
}

export async function getSubscriptionPackages(): Promise<SubscriptionPackage[]> {
  if (!(await ensureConfigured())) return [];
  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return packages.map((pkg: any) => ({
      identifier: pkg.identifier,
      priceString: pkg.product.priceString,
      title: pkg.product.title,
      rcPackage: pkg,
    }));
  } catch {
    return [];
  }
}

// Returns true when the purchase completed and the entitlement is active.
export async function purchasePackage(pkg: SubscriptionPackage): Promise<boolean> {
  if (!(await ensureConfigured())) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg.rcPackage);
    return hasEntitlement(customerInfo);
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.userCancelled) return false;
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!(await ensureConfigured())) return false;
  try {
    return hasEntitlement(await Purchases.restorePurchases());
  } catch {
    return false;
  }
}
