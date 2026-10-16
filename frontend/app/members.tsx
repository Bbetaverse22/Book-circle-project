import React, { useEffect, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AGENT_LIST } from '../constants/agents';
import { CLUB_SIZE, loadClubMembers, saveClubMembers } from '../utils/clubMembers';

// Pick the CLUB_SIZE members who will discuss the chosen book.
export default function MembersScreen() {
  const { bookTitle, bookAuthor } = useLocalSearchParams<{
    bookTitle: string;
    bookAuthor: string;
  }>();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    loadClubMembers().then(setSelected);
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((m) => m !== id);
      if (prev.length >= CLUB_SIZE) return prev;
      return [...prev, id];
    });
  };

  const ready = selected.length === CLUB_SIZE;

  const start = () => {
    if (!ready) return;
    void saveClubMembers(selected);
    router.replace({
      pathname: '/chat',
      params: { bookTitle, bookAuthor, members: selected.join(',') },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pick your club</Text>
        <Text style={styles.subtitle}>
          Choose {CLUB_SIZE} members to discuss{' '}
          <Text style={styles.bookTitle}>{bookTitle}</Text>
        </Text>
      </View>

      <FlatList
        data={AGENT_LIST}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id);
          const isFull = !isSelected && selected.length >= CLUB_SIZE;
          return (
            <TouchableOpacity
              style={[
                styles.card,
                isSelected && { borderColor: item.color, backgroundColor: '#25253a' },
                isFull && styles.cardDimmed,
              ]}
              activeOpacity={0.85}
              onPress={() => toggle(item.id)}
            >
              <View style={[styles.avatar, { backgroundColor: item.color }]}>
                <Text style={styles.avatarInitial}>{item.name.charAt(0)}</Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.role}>{item.role}</Text>
                </View>
                <Text style={styles.bio}>{item.bio}</Text>
              </View>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={26}
                color={isSelected ? item.color : '#555'}
              />
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, !ready && styles.ctaDisabled]}
          onPress={start}
          disabled={!ready}
        >
          <Text style={styles.ctaText}>
            {ready
              ? 'Start the discussion'
              : `Pick ${CLUB_SIZE - selected.length} more`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#12121f',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#e0e0e0',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  bookTitle: {
    color: '#e0e0e0',
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e30',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardDimmed: {
    opacity: 0.45,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  name: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '700',
  },
  role: {
    color: '#888',
    fontSize: 12,
  },
  bio: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    backgroundColor: '#1a1a2e',
  },
  cta: {
    backgroundColor: '#7c6af7',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaDisabled: {
    backgroundColor: '#3a3a55',
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
