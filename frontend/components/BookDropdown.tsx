import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Book, loadRecentBooks, POPULAR_BOOKS, searchBooks } from '../utils/books';

const SEARCH_DELAY_MS = 350;

interface BookDropdownProps {
  value: Book | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (book: Book) => void;
}

// A dropdown field: closed it shows the chosen book; open it lets the reader
// search any book or pick from recent and popular ones.
export function BookDropdown({ value, open, onToggle, onSelect }: BookDropdownProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [recent, setRecent] = useState<Book[]>([]);

  useEffect(() => {
    if (open) loadRecentBooks().then(setRecent);
  }, [open]);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setSearchFailed(false);
      return;
    }
    const controller = new AbortController();
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchBooks(trimmed, controller.signal)
        .then((books) => {
          setResults(books);
          setSearchFailed(false);
        })
        .catch((error: unknown) => {
          if ((error as Error).name !== 'AbortError') setSearchFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const choose = (book: Book) => {
    setQuery('');
    onSelect(book);
  };

  const renderBook = (book: Book, key: string) => (
    <TouchableOpacity key={key} style={styles.row} onPress={() => choose(book)}>
      <Cover book={book} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {book.title}
        </Text>
        {!!(book.author || book.year) && (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {[book.author, book.year].filter(Boolean).join(' · ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const isSearchMode = trimmed.length >= 2;

  return (
    <View style={[styles.field, open && styles.fieldOpen]}>
      <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.8}>
        {value ? (
          <>
            <Cover book={value} />
            <View style={styles.rowInfo}>
              <Text style={styles.label}>Book</Text>
              <Text style={styles.value} numberOfLines={1}>
                {value.title}
              </Text>
              {!!value.author && (
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {value.author}
                </Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.rowInfo}>
            <Text style={styles.label}>Book</Text>
            <Text style={styles.placeholder}>Choose or search any book</Text>
          </View>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#888" />
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#888" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by title or author"
              placeholderTextColor="#666"
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {isSearching && <ActivityIndicator size="small" color="#7c6af7" />}
          </View>

          {isSearchMode ? (
            <>
              {results.map((book, i) => renderBook(book, `r${i}`))}
              {!isSearching && searchFailed && (
                <Text style={styles.note}>Couldn't search right now — check your connection.</Text>
              )}
              {!isSearching && !searchFailed && results.length === 0 && (
                <Text style={styles.note}>No matches in the catalogue.</Text>
              )}
              <TouchableOpacity style={styles.row} onPress={() => choose({ title: trimmed })}>
                <View style={[styles.coverSmall, styles.coverPlaceholder]}>
                  <Ionicons name="create-outline" size={18} color="#7c6af7" />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Discuss "{trimmed}"</Text>
                  <Text style={styles.rowMeta}>Use exactly what you typed</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {recent.length > 0 && <Text style={styles.section}>Recent</Text>}
              {recent.map((book, i) => renderBook(book, `recent${i}`))}
              <Text style={styles.section}>Popular picks</Text>
              {POPULAR_BOOKS.map((book, i) => renderBook(book, `pop${i}`))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function Cover({ book }: { book: Book }) {
  if (!book.coverUrl) {
    return (
      <View style={[styles.coverSmall, styles.coverPlaceholder]}>
        <Ionicons name="book" size={18} color="#7c6af7" />
      </View>
    );
  }
  return <Image source={{ uri: book.coverUrl }} style={styles.coverSmall} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: '#1e1e30',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d2d44',
    overflow: 'hidden',
  },
  fieldOpen: {
    borderColor: '#7c6af7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  label: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  value: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  placeholder: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 2,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    paddingHorizontal: 12,
    backgroundColor: '#2d2d44',
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    color: '#e0e0e0',
    fontSize: 15,
    paddingVertical: 10,
  },
  section: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  note: {
    color: '#888',
    fontSize: 13,
    marginHorizontal: 14,
    marginVertical: 6,
  },
  coverSmall: {
    width: 36,
    height: 54,
    borderRadius: 4,
    backgroundColor: '#2d2d44',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
