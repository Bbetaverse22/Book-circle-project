// 50 ms of silence (8 kHz, 8-bit mono WAV).
const SILENT_WAV =
  'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

// iOS Safari only lets an <audio> element play without a fresh tap if that
// same element was started during an earlier tap. So every clip reuses one
// shared element, which unlockWebAudioPlayback() starts inside the tap.
let sharedElement: HTMLAudioElement | null = null;

function getSharedElement(): HTMLAudioElement {
  if (!sharedElement) {
    sharedElement = new Audio();
    sharedElement.setAttribute('playsinline', 'true');
  }
  return sharedElement;
}

// Call synchronously from a tap/press handler, before any await.
export async function unlockWebAudioPlayback(): Promise<void> {
  if (typeof window === 'undefined') return;

  const element = getSharedElement();
  element.src = SILENT_WAV;
  try {
    await element.play();
  } catch {
    // Browser may still allow later playback after explicit interaction.
  }
}

// Resolves the clip that is currently playing, if any.
let finishCurrent: (() => void) | null = null;

export async function playWebAudioBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const element = getSharedElement();

  try {
    await new Promise<void>((resolve, reject) => {
      finishCurrent = resolve;
      element.onended = () => resolve();
      element.onerror = () => reject(new Error('Voice playback failed'));
      element.src = url;
      element.volume = 1;
      element.play().catch(reject);
    });
  } finally {
    finishCurrent = null;
    element.onended = null;
    element.onerror = null;
    URL.revokeObjectURL(url);
  }
}

// Stop the clip that is playing; its playWebAudioBlob() call resolves.
// Leaves the element alone when no clip is playing, so it can't cancel the
// unlock started by the same tap.
export function stopWebAudio(): void {
  if (!finishCurrent) return;
  sharedElement?.pause();
  finishCurrent();
}
