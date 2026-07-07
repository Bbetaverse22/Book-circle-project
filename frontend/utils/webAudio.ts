const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

let unlocked = false;

export async function unlockWebAudioPlayback(): Promise<void> {
  if (unlocked || typeof window === 'undefined') return;

  const audio = new Audio(SILENT_WAV);
  audio.volume = 0.01;
  try {
    await audio.play();
    unlocked = true;
  } catch {
    // Browser may still allow later playback after explicit interaction.
  }
}

export async function playWebAudioBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);

  try {
    const element = new Audio(url);
    element.volume = 1;
    await element.play();
    await new Promise<void>((resolve, reject) => {
      element.onended = () => resolve();
      element.onerror = () => reject(new Error('Voice playback failed'));
    });
  } catch (error) {
    await unlockWebAudioPlayback();
    const retryElement = new Audio(url);
    retryElement.volume = 1;
    await retryElement.play();
    await new Promise<void>((resolve, reject) => {
      retryElement.onended = () => resolve();
      retryElement.onerror = () => reject(new Error('Voice playback failed'));
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
