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
  const bar1 = useRef(new Animated.Value(0.4)).current;
  const bar2 = useRef(new Animated.Value(0.4)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (isSpeaking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();

      const makeBarLoop = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.4, duration: 300, useNativeDriver: true }),
          ]),
        );
      makeBarLoop(bar1, 0).start();
      makeBarLoop(bar2, 150).start();
      makeBarLoop(bar3, 300).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      [bar1, bar2, bar3].forEach((b) => { b.stopAnimation(); b.setValue(0.4); });
    }
  }, [isSpeaking, pulseAnim, bar1, bar2, bar3]);

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
          {isSpeaking && (
            <View style={styles.waveform}>
              {[bar1, bar2, bar3].map((anim, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    { backgroundColor: agent.color, transform: [{ scaleY: anim }] },
                  ]}
                />
              ))}
            </View>
          )}
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
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 6,
    height: 20,
  },
  waveBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
});
