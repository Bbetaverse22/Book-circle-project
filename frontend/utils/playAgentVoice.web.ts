import { apiFetch } from '../constants/api';
import { playWebAudioBlob } from './webAudio';

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
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
  const blob = base64ToBlob(audio, 'audio/mpeg');
  await playWebAudioBlob(blob);
}

export { unlockWebAudioPlayback } from './webAudio';
