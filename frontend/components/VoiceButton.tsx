import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (isRecording) {
      // Pulsing red dot ring animation while recording
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
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.wrapper, disabled && styles.wrapperDisabled]}
    >
      {/* Pulsing ring — visible while recording */}
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
