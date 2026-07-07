import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';

import { createMutex } from '../utils/recordingMutex';
import {
  alertTranscriptionConnectionError,
  transcribeAudioBlob,
} from '../utils/transcribeAudio';

const MIN_RECORDING_MS = 400;

async function stopAndUnload(recording: Audio.Recording): Promise<string | null> {
  try {
    await recording.stopAndUnloadAsync();
    return recording.getURI();
  } catch {
    return recording.getURI();
  }
}

async function blobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export function useVoiceRecorder() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const withLockRef = useRef(createMutex());
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const releaseActiveRecording = useCallback(async () => {
    const current = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);

    if (current) {
      await stopAndUnload(current);
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
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

        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission Required', 'Microphone access is needed for voice input.');
          return null;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );

        recordingRef.current = recording;
        setIsRecording(true);
        return recording;
      } catch (error) {
        await releaseActiveRecording();
        console.error('Failed to start recording:', error);
        Alert.alert('Recording failed', 'Could not start the microphone. Please try again.');
        return null;
      }
    });
  }, [releaseActiveRecording]);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const withLock = withLockRef.current;

    setIsProcessing(true);
    try {
      const captured = await withLock(async () => {
        const recording = recordingRef.current;
        if (!recording) {
          return null;
        }

        let durationMs = 0;
        try {
          const status = await recording.getStatusAsync();
          durationMs = status.isLoaded ? status.durationMillis : 0;
        } catch {
          // Ignore status read errors and continue stopping.
        }

        recordingRef.current = null;
        setIsRecording(false);

        const uri = await stopAndUnload(recording);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});

        if (!uri) {
          Alert.alert('Recording failed', 'No audio was captured. Please try again.');
          return null;
        }

        if (durationMs < MIN_RECORDING_MS) {
          Alert.alert('Hold to speak', 'Press and hold the mic button a little longer while you talk.');
          return null;
        }

        return { uri, durationMs };
      });

      if (!captured) {
        return '';
      }

      const blob = await blobFromUri(captured.uri);
      const filename = Platform.OS === 'web' ? 'speech.webm' : 'speech.m4a';
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
