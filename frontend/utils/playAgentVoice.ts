import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import { apiFetch } from '../constants/api';

let stopCurrent: (() => void) | null = null;

export async function unlockWebAudioPlayback(): Promise<void> {
  // No-op on native — expo-av does not need browser unlock.
}

export async function playAgentVoice(
  text: string,
  voiceId: string,
  agentId: string,
): Promise<void> {
  const response = await apiFetch('/voice/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, agentId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Voice synthesis failed');
  }

  const { audio } = (await response.json()) as { audio: string };
  const audioUri = `${FileSystem.cacheDirectory}agent_${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(audioUri, audio, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { sound } = await Audio.Sound.createAsync({ uri: audioUri });

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      stopCurrent = null;
      sound.unloadAsync().then(() =>
        FileSystem.deleteAsync(audioUri, { idempotent: true }),
      );
      resolve();
    };
    stopCurrent = finish;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) finish();
    });
    sound.playAsync();
  });
}

// Stop the clip that is playing; its playAgentVoice() call resolves.
export function stopAgentVoice(): void {
  stopCurrent?.();
}
