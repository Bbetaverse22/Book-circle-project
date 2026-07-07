import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Tiny cross-platform key-value store for small strings (device ID,
// onboarding flag). SecureStore on native, localStorage on web.

export async function kvGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (private browsing) — value lives for the session only.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}
