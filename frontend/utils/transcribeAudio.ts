import { Alert } from 'react-native';

import { API_URL } from '../constants/api';

export async function transcribeAudioBlob(
  blob: Blob,
  filename: string,
): Promise<string> {
  const formData = new FormData();
  formData.append('audio', blob, filename);

  const res = await fetch(`${API_URL}/voice/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Transcription request failed:', errorText);
    Alert.alert(
      'Transcription failed',
      'Could not reach the server or transcribe your voice. Check that the backend is running.',
    );
    return '';
  }

  const { text } = (await res.json()) as { text?: string };
  if (!text?.trim()) {
    Alert.alert('No speech detected', 'Try speaking a bit louder or closer to the microphone.');
    return '';
  }

  return text;
}

export function alertTranscriptionConnectionError(error: unknown): void {
  console.error('Transcription request failed:', error);
  Alert.alert(
    'Connection failed',
    `Could not reach the API at ${API_URL}. Make sure the backend is running.`,
  );
}
