import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AGENT_LIST } from '../constants/agents';
import { kvSet } from '../utils/kvStore';

export const ONBOARDING_KEY = 'bookcircle_onboarded';

const STEPS: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; body: string }> = [
  {
    icon: 'book',
    title: 'Pick a book',
    body: 'Choose a classic from the shelf — the club has read them all.',
  },
  {
    icon: 'mic',
    title: 'Ask out loud or type',
    body: 'Hold the mic to ask with your voice, or just type your question.',
  },
  {
    icon: 'people',
    title: 'Hear 7 perspectives',
    body: 'Every member answers in their own voice — a nurse, a critic, a philosopher, and more.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();

  const finish = async () => {
    await kvSet(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>📚</Text>
        <Text style={styles.title}>Welcome to BookCircle</Text>
        <Text style={styles.subtitle}>
          Your book club of seven, always ready to talk.
        </Text>

        {/* Members preview */}
        <View style={styles.avatarRow}>
          {AGENT_LIST.map((agent) => (
            <View
              key={agent.id}
              style={[styles.avatar, { backgroundColor: agent.color }]}
            >
              <Text style={styles.avatarInitial}>
                {agent.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={styles.steps}>
          {STEPS.map((step) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={22} color="#7c6af7" />
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.micNote}>
          BookCircle uses your microphone only while you hold the mic button,
          to turn your voice into a question.
        </Text>

        <TouchableOpacity style={styles.cta} onPress={finish}>
          <Text style={styles.ctaText}>Join the club</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121f',
  },
  scroll: {
    padding: 28,
    paddingTop: 48,
    flexGrow: 1,
    justifyContent: 'center',
  },
  logo: {
    fontSize: 56,
    textAlign: 'center',
  },
  title: {
    color: '#e0e0e0',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    color: '#999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -4,
    borderWidth: 2,
    borderColor: '#12121f',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  steps: {
    gap: 20,
    marginBottom: 28,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1e1e30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '700',
  },
  stepBody: {
    color: '#999',
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  micNote: {
    color: '#666',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 20,
  },
  cta: {
    backgroundColor: '#7c6af7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
