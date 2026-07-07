import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { createMutex } from '../utils/recordingMutex';
import {
  alertTranscriptionConnectionError,
  transcribeAudioBlob,
} from '../utils/transcribeAudio';

const MIN_RECORDING_MS = 400;

function getSupportedMimeType(): string | null {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
}

export function useVoiceRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const startedAtRef = useRef(0);
  const withLockRef = useRef(createMutex());
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const releaseActiveRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);

    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const withLock = withLockRef.current;
    return () => {
      void withLock(() => releaseActiveRecording());
    };
  }, [releaseActiveRecording]);

  const startRecording = useCallback(async () => {
    const withLock = withLockRef.current;

    return withLock(async () => {
      try {
        await releaseActiveRecording();

        const mimeType = getSupportedMimeType();
        if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
          Alert.alert(
            'Microphone unavailable',
            'Voice recording is not supported in this browser.',
          );
          return null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType });

        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.start(250);
        streamRef.current = stream;
        mediaRecorderRef.current = recorder;
        mimeTypeRef.current = mimeType;
        startedAtRef.current = Date.now();
        setIsRecording(true);
        return recorder;
      } catch (error) {
        await releaseActiveRecording();
        console.error('Failed to start recording:', error);
        Alert.alert('Recording failed', 'Could not access the microphone. Please allow mic access and try again.');
        return null;
      }
    });
  }, [releaseActiveRecording]);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const withLock = withLockRef.current;

    setIsProcessing(true);
    try {
      const blob = await withLock(async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) {
          Alert.alert('Recording failed', 'No active recording found. Please try again.');
          return null;
        }

        const durationMs = Date.now() - startedAtRef.current;
        mediaRecorderRef.current = null;
        setIsRecording(false);

        const audioBlob = await new Promise<Blob>((resolve, reject) => {
          recorder.addEventListener(
            'stop',
            () => {
              const recorded = new Blob(chunksRef.current, {
                type: mimeTypeRef.current,
              });
              chunksRef.current = [];
              resolve(recorded);
            },
            { once: true },
          );
          recorder.addEventListener(
            'error',
            () => reject(new Error('Recording failed')),
            { once: true },
          );
          recorder.stop();
        });

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (durationMs < MIN_RECORDING_MS || audioBlob.size === 0) {
          Alert.alert('Hold to speak', 'Press and hold the mic button a little longer while you talk.');
          return null;
        }

        return audioBlob;
      });

      if (!blob) {
        return '';
      }

      const filename = `speech.${extensionForMimeType(blob.type || mimeTypeRef.current)}`;
      return await transcribeAudioBlob(blob, filename);
    } catch (error) {
      alertTranscriptionConnectionError(error);
      return '';
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { startRecording, stopAndTranscribe, isRecording, isProcessing };
}
