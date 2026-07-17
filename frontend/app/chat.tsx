import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AGENTS } from '../constants/agents';
import { apiFetch, LimitReachedError, UsageInfo } from '../constants/api';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { AgentBubble, UserBubble } from '../components/ChatBubble';
import { VoiceButton } from '../components/VoiceButton';
import { playAgentVoice, unlockWebAudioPlayback } from '../utils/playAgentVoice';

// ── Types ────────────────────────────────────────────────────────────────────

type UserMessage = { id: string; type: 'user'; text: string };
type AgentResponse = { agentId: string; text: string };
type AgentGroupMessage = { id: string; type: 'agents'; responses: AgentResponse[] };
type ChatMessage = UserMessage | AgentGroupMessage;

type ConversationTurn = { role: 'user' | 'assistant'; content: string };

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { bookTitle, bookAuthor } = useLocalSearchParams<{
    bookTitle: string;
    bookAuthor: string;
  }>();
  const navigation = useNavigation();
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  // Load current quota so the free-question counter is right from the start.
  React.useEffect(() => {
    apiFetch('/usage')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { isSubscriber: boolean; questions: { used: number; limit: number; remaining: number } } | null) => {
        if (data) {
          setUsage({ ...data.questions, isSubscriber: data.isSubscriber });
        }
      })
      .catch(() => {
        // Backend unreachable — the send path surfaces its own error.
      });
  }, []);

  // Shared conversation history for all agents (user turns + last assistant turn)
  const conversationHistory = useRef<ConversationTurn[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const { startRecording, stopAndTranscribe, isRecording, isProcessing } = useVoiceRecorder();

  // Set header subtitle to book title
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: bookTitle ?? 'Book Club',
    });
  }, [navigation, bookTitle, bookAuthor]);

  // ── Send message to all agents ──────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setInputText('');
      setIsLoading(true);

      // Add user bubble immediately
      const userId = `user_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: userId, type: 'user', text: trimmed },
      ]);

      // Build history for this request
      const historyForRequest: ConversationTurn[] = [...conversationHistory.current];

      try {
        // One request — the backend fans out to all agents server-side.
        let agentResponses: AgentResponse[];
        try {
          const res = await apiFetch('/club/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: trimmed,
              history: historyForRequest,
            }),
          });

          if (!res.ok) {
            throw new Error(`Request failed (${res.status})`);
          }

          const data = (await res.json()) as {
            responses: Array<{ agentId: string; text: string; error?: boolean }>;
            usage?: UsageInfo & { category: string };
          };

          if (data.usage) {
            setUsage({
              used: data.usage.used,
              limit: data.usage.limit,
              remaining: data.usage.remaining,
              isSubscriber: data.usage.isSubscriber,
            });
          }

          agentResponses = data.responses
            .filter((r) => !r.error && r.text)
            .map((r) => ({ agentId: r.agentId, text: r.text }));
        } catch (error) {
          // Remove the optimistic user bubble so the question can be retried.
          setMessages((prev) => prev.filter((m) => m.id !== userId));
          setInputText(trimmed);

          if (error instanceof LimitReachedError) {
            if (error.usage) {
              setUsage(error.usage);
            }
            router.push('/paywall');
          } else {
            Alert.alert(
              'Could not reach the club',
              'The book club is unavailable right now. Check your connection and try again.',
            );
          }
          return;
        }

        // Add agent response group bubble
        const groupId = `agents_${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          { id: groupId, type: 'agents', responses: agentResponses },
        ]);

        // Update shared history: user turn + summarised agent turn
        conversationHistory.current = [
          ...historyForRequest,
          { role: 'user', content: trimmed },
          {
            role: 'assistant',
            content: agentResponses
              .map((r) => `${AGENTS[r.agentId]?.name ?? r.agentId}: ${r.text}`)
              .join('\n'),
          },
        ];

        // Scroll to bottom
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );

        // Play voice responses in sequence when voice mode is on and not muted
        if (isVoiceMode && !isMuted) {
          let voiceFailed = false;
          for (const response of agentResponses) {
            const agent = AGENTS[response.agentId];
            if (!agent) continue;
            setSpeakingAgentId(agent.id);
            try {
              await playAgentVoice(response.text, agent.voiceId, agent.id);
            } catch (error) {
              voiceFailed = true;
              console.error(`Voice playback failed for ${agent.name}:`, error);
            }
          }
          setSpeakingAgentId(null);
          if (voiceFailed) {
            Alert.alert(
              'Voice playback issue',
              'Some responses could not be played aloud. Check your browser volume and try again.',
            );
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, isMuted, isVoiceMode, router],
  );

  // ── Voice input handlers ────────────────────────────────────────────────

  const handleMicPressIn = () => {
    if (isLoading || isRecording || isProcessing) return;
    void unlockWebAudioPlayback();
    void startRecording();
  };

  const handleMicPressOut = () => {
    if (isProcessing) return;
    void stopAndTranscribe().then((transcribed) => {
      if (transcribed) {
        void sendMessage(transcribed);
      }
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.type === 'user') {
      return <UserBubble text={item.text} />;
    }
    // Render each agent's response as its own bubble
    return (
      <View>
        {item.responses.map((response) => {
          const agent = AGENTS[response.agentId];
          if (!agent) return null;
          return (
            <AgentBubble
              key={response.agentId}
              agent={agent}
              text={response.text}
              isSpeaking={speakingAgentId === response.agentId}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Book info banner */}
      <View style={styles.bookBanner}>
        <Ionicons name="book" size={16} color="#7c6af7" />
        <Text style={styles.bookBannerTitle} numberOfLines={1}>
          {bookTitle}
        </Text>
        <Text style={styles.bookBannerAuthor}>{bookAuthor}</Text>
        {usage && !usage.isSubscriber && (
          <TouchableOpacity
            style={styles.quotaChip}
            onPress={() => router.push('/paywall')}
          >
            <Text style={styles.quotaChipText}>
              {usage.remaining > 0
                ? `${usage.remaining} free left today`
                : 'Upgrade'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>
              Ask the club something about{' '}
              <Text style={styles.emptyBold}>{bookTitle}</Text>
            </Text>
            <Text style={styles.emptySubtext}>
              All 7 members will respond in their own voice.
            </Text>
          </View>
        }
      />

      {/* Loading / voice processing indicator */}
      {(isLoading || isProcessing) && (
        <View style={styles.loadingBar}>
          <Text style={styles.loadingText}>
            {isProcessing
              ? 'Processing your voice…'
              : speakingAgentId
                ? `${AGENTS[speakingAgentId]?.name ?? ''} is speaking…`
                : 'Asking the club…'}
          </Text>
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inputBar}>
          {/* Voice / text mode toggle */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setIsVoiceMode((v) => {
                const next = !v;
                if (next) {
                  void unlockWebAudioPlayback();
                }
                return next;
              });
            }}
          >
            <Ionicons
              name={isVoiceMode ? 'chatbubble-outline' : 'mic-outline'}
              size={22}
              color="#7c6af7"
            />
          </TouchableOpacity>

          {/* Text input or voice button */}
          {isVoiceMode ? (
            <View style={styles.voiceCenter}>
              <VoiceButton
                isRecording={isRecording}
                disabled={isLoading || isProcessing}
                onPressIn={handleMicPressIn}
                onPressOut={handleMicPressOut}
              />
              <Text style={styles.voiceHint}>
                {isProcessing
                  ? 'Processing…'
                  : isRecording
                    ? 'Release to send'
                    : 'Hold to speak'}
              </Text>
            </View>
          ) : (
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask the book club…"
              placeholderTextColor="#555"
              multiline
              returnKeyType="send"
              onSubmitEditing={() => sendMessage(inputText)}
            />
          )}

          {/* Mute toggle */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setIsMuted((m) => !m)}
          >
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-medium-outline'}
              size={22}
              color={isMuted ? '#e53935' : '#7c6af7'}
            />
          </TouchableOpacity>

          {/* Send button (text mode only) */}
          {!isVoiceMode && (
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isLoading}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121f',
  },
  bookBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  bookBannerTitle: {
    color: '#e0e0e0',
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  bookBannerAuthor: {
    color: '#888',
    fontSize: 12,
  },
  quotaChip: {
    backgroundColor: '#2d2d44',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  quotaChipText: {
    color: '#b3a7ff',
    fontSize: 11,
    fontWeight: '600',
  },
  messageList: {
    paddingVertical: 12,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBold: {
    color: '#e0e0e0',
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
  loadingBar: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: '#1e1e30',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  loadingText: {
    color: '#7c6af7',
    fontSize: 13,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    gap: 8,
    minHeight: 64,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2d2d44',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#e0e0e0',
    fontSize: 15,
    maxHeight: 100,
  },
  voiceCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  voiceHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 24,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c6af7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
