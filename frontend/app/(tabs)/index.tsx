import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ONBOARDING_KEY } from '../onboarding';
import { kvGet } from '../../utils/kvStore';
import { Book, rememberBook } from '../../utils/books';
import { CLUB_SIZE, loadClubMembers, saveClubMembers } from '../../utils/clubMembers';
import { BookDropdown } from '../../components/BookDropdown';
import { MemberDropdown } from '../../components/MemberDropdown';

type OpenField = 'book' | 'members' | null;

// One page to set up a discussion: pick a book and a club of three, then start.
export default function HomeScreen() {
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [openField, setOpenField] = useState<OpenField>('book');

  // First launch → show onboarding once.
  useEffect(() => {
    kvGet(ONBOARDING_KEY).then((seen) => {
      if (!seen) {
        router.replace('/onboarding');
      }
    });
  }, [router]);

  // Start from the reader's last club.
  useEffect(() => {
    loadClubMembers().then(setMembers);
  }, []);

  const toggle = (field: Exclude<OpenField, null>) =>
    setOpenField((current) => (current === field ? null : field));

  const selectBook = (picked: Book) => {
    setBook(picked);
    setOpenField(members.length === CLUB_SIZE ? null : 'members');
  };

  const changeMembers = (ids: string[]) => {
    setMembers(ids);
    if (ids.length === CLUB_SIZE) setOpenField(null);
  };

  const ready = !!book && members.length === CLUB_SIZE;

  const start = () => {
    if (!book || !ready) return;
    void rememberBook(book);
    void saveClubMembers(members);
    router.push({
      pathname: '/chat',
      params: {
        bookTitle: book.title,
        bookAuthor: book.author ?? '',
        members: members.join(','),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📚 BookCircle</Text>
          <Text style={styles.headerSubtitle}>
            Pick any book and three readers to talk it over with.
          </Text>
        </View>

        <View style={styles.form}>
          <BookDropdown
            value={book}
            open={openField === 'book'}
            onToggle={() => toggle('book')}
            onSelect={selectBook}
          />
          <MemberDropdown
            value={members}
            open={openField === 'members'}
            onToggle={() => toggle('members')}
            onChange={changeMembers}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, !ready && styles.ctaDisabled]}
          onPress={start}
          disabled={!ready}
        >
          <Text style={styles.ctaText}>
            {!book
              ? 'Choose a book'
              : members.length < CLUB_SIZE
                ? `Pick ${CLUB_SIZE - members.length} more member${CLUB_SIZE - members.length === 1 ? '' : 's'}`
                : 'Start the discussion'}
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
  content: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e0e0e0',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  form: {
    paddingHorizontal: 16,
    gap: 12,
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
