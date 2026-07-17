import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceButtonProps {
  isRecording: boolean;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
}

export function VoiceButton({
  isRecording,
  disabled = false,
  onPressIn,
  onPressOut,
}: VoiceButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const onPressInRef = useRef(onPressIn);
  const onPressOutRef = useRef(onPressOut);
  const isListeningRef = useRef(false);
  const stopHandledRef = useRef(false);
  const cleanupListenersRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onPressInRef.current = onPressIn;
    onPressOutRef.current = onPressOut;
  }, [onPressIn, onPressOut]);

  const finishRecording = useCallback(() => {
    if (!isListeningRef.current || stopHandledRef.current) return;
    stopHandledRef.current = true;
    isListeningRef.current = false;
    cleanupListenersRef.current?.();
    cleanupListenersRef.current = null;
    onPressOutRef.current();
  }, []);

  const beginListening = useCallback(() => {
    const handlePointerUp = () => finishRecording();

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [finishRecording]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    stopHandledRef.current = false;
    isListeningRef.current = true;
    cleanupListenersRef.current?.();
    cleanupListenersRef.current = beginListening();
    onPressInRef.current();
  }, [disabled, beginListening]);

  useEffect(() => {
    return () => {
      cleanupListenersRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      isListeningRef.current = false;
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.6,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0);
    }
  }, [isRecording, pulseAnim, pulseOpacity]);

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={finishRecording}
      style={[styles.wrapper, disabled && styles.wrapperDisabled]}
    >
      <Animated.View
        style={[
          styles.pulse,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.button,
          isRecording && styles.buttonRecording,
        ]}
      >
        <Ionicons
          name={isRecording ? 'mic' : 'mic-outline'}
          size={24}
          color="#fff"
        />
      </Animated.View>
      {isRecording && (
        <Text style={styles.recordingLabel}>Recording…</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
  },
  wrapperDisabled: {
    opacity: 0.5,
  },
  pulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e53935',
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c6af7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  buttonRecording: {
    backgroundColor: '#e53935',
  },
  recordingLabel: {
    position: 'absolute',
    bottom: -18,
    fontSize: 10,
    color: '#e53935',
    fontWeight: '600',
  },
});
