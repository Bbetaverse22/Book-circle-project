import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function unloadRecording(recording: Audio.Recording) {
  try {
    const status = await recording.getStatusAsync();
    if (status.isLoaded) {
      await recording.stopAndUnloadAsync();
    }
  } catch {
    // Recording may already be unloaded.
  }
}

export function useVoiceRecorder() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isStartingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);

  const cleanup = useCallback(async () => {
    const current = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);

    if (current) {
      await unloadRecording(current);
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current) return;

    isStartingRef.current = true;
    try {
      if (recordingRef.current) {
        await cleanup();
      }

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is needed for voice input.');
        return;
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
    } catch (error) {
      await cleanup();
      console.error('Failed to start recording:', error);
    } finally {
      isStartingRef.current = false;
    }
  }, [cleanup]);

  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const recording = recordingRef.current;
    if (!recording) return '';

    recordingRef.current = null;
    setIsRecording(false);

    await unloadRecording(recording);
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});

    const uri = recording.getURI();
    if (!uri) return '';

    const formData = new FormData();
    formData.append('audio', {
      uri,
      type: 'audio/m4a',
      name: 'speech.m4a',
    } as unknown as Blob);

    try {
      const res = await fetch(`${API_URL}/voice/transcribe`, {
        method: 'POST',
        body: formData,
      });
      const { text } = (await res.json()) as { text: string };
      return text ?? '';
    } catch {
      return '';
    }
  }, []);

  return { startRecording, stopAndTranscribe, isRecording };
}
