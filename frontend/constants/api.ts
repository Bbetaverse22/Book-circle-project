import Constants from 'expo-constants';
import { Platform } from 'react-native';

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
