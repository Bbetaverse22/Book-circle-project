import { useState } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export function useVoiceRecorder() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission Required', 'Microphone access is needed for voice input.');
      return;
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true });

    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );

    setRecording(newRecording);
    setIsRecording(true);
  };

  const stopAndTranscribe = async (): Promise<string> => {
    if (!recording) return '';

    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri = recording.getURI();
    setRecording(null);
    setIsRecording(false);

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
  };

  return { startRecording, stopAndTranscribe, isRecording };
}
