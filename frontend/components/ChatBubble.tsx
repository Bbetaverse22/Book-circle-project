import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Agent } from '../constants/agents';

interface UserBubbleProps {
  text: string;
}

export function UserBubble({ text }: UserBubbleProps) {
  return (
    <View style={styles.userBubbleWrapper}>
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{text}</Text>
      </View>
    </View>
  );
}

interface AgentBubbleProps {
  agent: Agent;
  text: string;
  isSpeaking: boolean;
}

export function AgentBubble({ agent, text, isSpeaking }: AgentBubbleProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isSpeaking, pulseAnim]);

  return (
    <View style={styles.agentBubbleWrapper}>
      {/* Agent avatar circle with speaking pulse */}
      <Animated.View
        style={[
          styles.avatar,
          { backgroundColor: agent.color, transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Text style={styles.avatarInitial}>
          {agent.name.charAt(0).toUpperCase()}
        </Text>
      </Animated.View>

      <View style={styles.agentBubbleBody}>
        {/* Agent name + role */}
        <View style={styles.agentHeader}>
          <Text style={[styles.agentName, { color: agent.color }]}>
            {agent.name}
          </Text>
          <Text style={styles.agentRole}>{agent.role}</Text>
          {isSpeaking && (
            <View style={styles.speakingDot} />
          )}
        </View>

        {/* Message bubble */}
        <View style={[styles.agentBubble, { borderLeftColor: agent.color }]}>
          {/* Transcript shown below audio indicator */}
          <Text style={styles.agentText}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  userBubbleWrapper: {
    alignItems: 'flex-end',
    marginVertical: 6,
    marginHorizontal: 16,
  },
  userBubble: {
    backgroundColor: '#7c6af7',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  userText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  agentBubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 6,
    marginHorizontal: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 16,
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  agentBubbleBody: {
    flex: 1,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  agentName: {
    fontWeight: '700',
    fontSize: 13,
  },
  agentRole: {
    color: '#888',
    fontSize: 12,
  },
  speakingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4caf50',
  },
  agentBubble: {
    backgroundColor: '#2d2d44',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '90%',
  },
  agentText: {
    color: '#e0e0e0',
    fontSize: 15,
    lineHeight: 20,
  },
});
