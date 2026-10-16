import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  playAgentVoice,
  stopAgentVoice,
  unlockWebAudioPlayback,
} from '../utils/playAgentVoice';
import { CLUB_SIZE } from '../utils/clubMembers';

// ── Types ────────────────────────────────────────────────────────────────────

// One line of the group chat; `speaker` is 'user' or a member id.
type ClubLine = { speaker: string; text: string };
type ChatMessage = ClubLine & { id: string };

// Follow-up replies after the first answer (the backend enforces the same cap).
const MAX_FOLLOWUPS = 3;

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { bookTitle, bookAuthor, members } = useLocalSearchParams<{
    bookTitle: string;
    bookAuthor: string;
    members: string;
  }>();
  const navigation = useNavigation();
  const router = useRouter();

  const memberIds = useMemo(
    () => (members ?? '').split(',').filter((id) => AGENTS[id]),
    [members],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // Waiting for the first answer to the reader's message.
  const [isAsking, setIsAsking] = useState(false);
  // Waiting to hear whether another member wants to add something.
  const [isWaitingForMore, setIsWaitingForMore] = useState(false);
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  // What the backend sees: the whole group chat so far.
  const transcript = useRef<ClubLine[]>([]);
  // Bumped whenever the reader speaks; stale follow-up loops check it and stop.
  const round = useRef(0);
  const isMutedRef = useRef(isMuted);
  const voiceAlertShown = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  const { startRecording, stopAndTranscribe, isRecording, isProcessing } = useVoiceRecorder();

  // Without a full club (e.g. an old link), go pick members first.
  useEffect(() => {
    if (memberIds.length !== CLUB_SIZE) {
      router.replace({ pathname: '/members', params: { bookTitle, bookAuthor } });
    }
  }, [memberIds, router, bookTitle, bookAuthor]);

  // Load current quota so the free-question counter is right from the start.
  useEffect(() => {
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

  useEffect(() => {
    navigation.setOptions({
      headerTitle: bookTitle ?? 'Book Club',
    });
  }, [navigation, bookTitle]);

  // Stop talking when the reader leaves the screen.
  useEffect(
    () => () => {
      round.current += 1;
      stopAgentVoice();
    },
    [],
  );

  const clubBody = (lines: ClubLine[]) => ({
    members: memberIds,
    book: bookTitle ? { title: bookTitle, author: bookAuthor } : undefined,
    transcript: lines,
  });

  const addLine = (line: ClubLine) => {
    transcript.current = [...transcript.current, line];
    setMessages((prev) => [
      ...prev,
      { ...line, id: `${line.speaker}_${Date.now()}_${prev.length}` },
    ]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Stop whatever the club is doing so the reader can take the floor.
  const interrupt = () => {
    round.current += 1;
    stopAgentVoice();
    setSpeakingAgentId(null);
    setIsWaitingForMore(false);
  };

  const speak = async (line: ClubLine, myRound: number) => {
    const agent = AGENTS[line.speaker];
    if (!agent || isMutedRef.current || myRound !== round.current) return;
    setSpeakingAgentId(agent.id);
    try {
      await playAgentVoice(line.text, agent.voiceId, agent.id);
    } catch (error) {
      console.error(`Voice playback failed for ${agent.name}:`, error);
      if (!voiceAlertShown.current) {
        voiceAlertShown.current = true;
        Alert.alert(
          'Voice playback issue',
          'Some replies could not be played aloud. Check your volume and try again.',
        );
      }
    } finally {
      if (myRound === round.current) setSpeakingAgentId(null);
    }
  };

  // Ask whether another member wants to add something. null = floor goes back
  // to the reader (including when the daily follow-up allowance is used up).
  const fetchFollowup = async (lines: ClubLine[]): Promise<ClubLine | null> => {
    try {
      const res = await apiFetch('/club/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clubBody(lines)),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { message?: ClubLine; done?: boolean };
      return data.message ?? null;
    } catch {
      return null;
    }
  };

  // After the first answer: speak it, and while it plays find out whether
  // someone else jumps in. Repeat until the floor goes back to the reader.
  const continueDiscussion = async (first: ClubLine, myRound: number) => {
    let line = first;
    for (let i = 0; i < MAX_FOLLOWUPS; i += 1) {
      const next = fetchFollowup(transcript.current);
      await speak(line, myRound);
      if (myRound !== round.current) return;
      setIsWaitingForMore(true);
      const followup = await next;
      if (myRound !== round.current) return;
      setIsWaitingForMore(false);
      if (!followup) return;
      addLine(followup);
      line = followup;
    }
    await speak(line, myRound);
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isAsking) return;

      interrupt();
      const myRound = round.current;
      setInputText('');
      setIsAsking(true);

      const history = transcript.current;
      addLine({ speaker: 'user', text: trimmed });

      let first: ClubLine;
      try {
        const res = await apiFetch('/club/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...clubBody(history), text: trimmed }),
        });

        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }

        const data = (await res.json()) as {
          message: ClubLine;
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
        if (!data.message?.text) {
          throw new Error('Empty reply');
        }
        first = data.message;
      } catch (error) {
        // Take the reader's message back out so it can be retried.
        transcript.current = history;
        setMessages((prev) => prev.slice(0, -1));
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
      } finally {
        setIsAsking(false);
      }

      if (myRound !== round.current) return;
      addLine(first);
      await continueDiscussion(first, myRound);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAsking, memberIds, bookTitle, bookAuthor, router],
  );

  const toggleMute = () => {
    setIsMuted((muted) => {
      const next = !muted;
      isMutedRef.current = next;
      if (next) {
        stopAgentVoice();
        setSpeakingAgentId(null);
      } else {
        void unlockWebAudioPlayback();
      }
      return next;
    });
  };

  const sendTyped = () => {
    interrupt();
    void unlockWebAudioPlayback();
    void sendMessage(inputText);
  };

  // ── Voice input handlers ────────────────────────────────────────────────

  const handleMicPressIn = () => {
    if (isAsking || isRecording || isProcessing) return;
    interrupt();
    void unlockWebAudioPlayback();
    void startRecording();
  };

  const handleMicPressOut = () => {
    if (isProcessing) return;
    void stopAndTranscribe({ title: bookTitle, author: bookAuthor }).then((transcribed) => {
      if (transcribed) {
        void sendMessage(transcribed);
      }
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const club = memberIds.map((id) => AGENTS[id]);
  const clubNames =
    club.length === CLUB_SIZE
      ? `${club[0].name}, ${club[1].name} and ${club[2].name}`
      : 'Your club';

  // A member speaks their latest line, so only that bubble animates.
  const speakingMessageId = speakingAgentId
    ? [...messages].reverse().find((m) => m.speaker === speakingAgentId)?.id
    : undefined;

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.speaker === 'user') {
      return <UserBubble text={item.text} />;
    }
    const agent = AGENTS[item.speaker];
    if (!agent) return null;
    return (
      <AgentBubble
        agent={agent}
        text={item.text}
        isSpeaking={item.id === speakingMessageId}
      />
    );
  };

  const typingLabel = isProcessing
    ? 'Listening to you…'
    : isAsking
      ? 'The club is thinking…'
      : isWaitingForMore && !speakingAgentId
        ? 'Anyone want to add something?'
        : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Club banner: who's here + quota */}
      <View style={styles.bookBanner}>
        <View style={styles.clubAvatars}>
          {club.map((agent, i) => (
            <View
              key={agent.id}
              style={[
                styles.clubAvatar,
                { backgroundColor: agent.color, marginLeft: i === 0 ? 0 : -8 },
                speakingAgentId === agent.id && styles.clubAvatarSpeaking,
              ]}
            >
              <Text style={styles.clubAvatarInitial}>{agent.name.charAt(0)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.bookBannerTitle} numberOfLines={1}>
          {speakingAgentId ? `${AGENTS[speakingAgentId].name} is speaking…` : clubNames}
        </Text>
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
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>
              Start the conversation about{' '}
              <Text style={styles.emptyBold}>{bookTitle}</Text>
            </Text>
            <Text style={styles.emptySubtext}>
              {clubNames} are here. Ask anything — whoever has the most to say
              will answer first, and the others can jump in.
            </Text>
          </View>
        }
        ListFooterComponent={
          typingLabel ? (
            <View style={styles.typingRow}>
              <View style={styles.typingBubble}>
                <Text style={styles.typingDots}>• • •</Text>
              </View>
              <Text style={styles.typingText}>{typingLabel}</Text>
            </View>
          ) : null
        }
      />

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inputBar}>
          {/* Voice / text mode toggle */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              void unlockWebAudioPlayback();
              setIsVoiceMode((v) => !v);
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
                disabled={isAsking || isProcessing}
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
              placeholder="Say something to the club…"
              placeholderTextColor="#555"
              multiline
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={sendTyped}
            />
          )}

          {/* Mute toggle */}
          <TouchableOpacity style={styles.iconButton} onPress={toggleMute}>
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
                (!inputText.trim() || isAsking) && styles.sendButtonDisabled,
              ]}
              onPress={sendTyped}
              disabled={!inputText.trim() || isAsking}
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
  clubAvatars: {
    flexDirection: 'row',
  },
  clubAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  clubAvatarSpeaking: {
    borderColor: '#4caf50',
  },
  clubAvatarInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
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
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  typingBubble: {
    backgroundColor: '#2d2d44',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typingDots: {
    color: '#7c6af7',
    fontSize: 12,
    letterSpacing: 2,
  },
  typingText: {
    color: '#888',
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
