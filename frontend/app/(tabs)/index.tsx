import React from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AGENT_LIST } from '../../constants/agents';

const BOOKS = [
  { id: '1', title: 'To Kill a Mockingbird', author: 'Harper Lee' },
  { id: '2', title: '1984', author: 'George Orwell' },
  { id: '3', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { id: '4', title: 'Brave New World', author: 'Aldous Huxley' },
  { id: '5', title: 'Pride and Prejudice', author: 'Jane Austen' },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📚 BookCircle</Text>
        <Text style={styles.headerSubtitle}>AI Book Club</Text>
      </View>

      {/* Agents strip */}
      <View style={styles.agentsSection}>
        <Text style={styles.sectionLabel}>Your Club Members</Text>
        <FlatList
          data={AGENT_LIST}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.agentsList}
          renderItem={({ item }) => (
            <View style={styles.agentChip}>
              <View style={[styles.agentDot, { backgroundColor: item.color }]} />
              <Text style={styles.agentChipName}>{item.name}</Text>
              <Text style={styles.agentChipRole}>{item.role}</Text>
            </View>
          )}
        />
      </View>

      {/* Book list */}
      <Text style={styles.sectionLabel}>Choose a Book to Discuss</Text>
      <FlatList
        data={BOOKS}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.booksList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.bookCard}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: '/chat',
                params: { bookTitle: item.title, bookAuthor: item.author },
              })
            }
          >
            <View style={styles.bookIcon}>
              <Ionicons name="book" size={28} color="#7c6af7" />
            </View>
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle}>{item.title}</Text>
              <Text style={styles.bookAuthor}>{item.author}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#555" />
          </TouchableOpacity>
        )}
      />
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
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e0e0e0',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  agentsSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  agentsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  agentChip: {
    backgroundColor: '#1e1e30',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  agentDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 4,
  },
  agentChipName: {
    color: '#e0e0e0',
    fontSize: 12,
    fontWeight: '700',
  },
  agentChipRole: {
    color: '#888',
    fontSize: 10,
  },
  booksList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e30',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  bookIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookInfo: {
    flex: 1,
  },
  bookTitle: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '700',
  },
  bookAuthor: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
});
