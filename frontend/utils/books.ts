import { kvGet, kvSet } from './kvStore';

export interface Book {
  title: string;
  author?: string;
  year?: number;
  coverUrl?: string;
}

function coverUrl(coverId?: number): string | undefined {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;
}

// Shown before the reader searches.
export const POPULAR_BOOKS: Book[] = [
  { title: 'To Kill a Mockingbird', author: 'Harper Lee', year: 1960, coverUrl: coverUrl(14351077) },
  { title: '1984', author: 'George Orwell', year: 1949, coverUrl: coverUrl(9267242) },
  { title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813, coverUrl: coverUrl(14348537) },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925, coverUrl: coverUrl(10590366) },
  { title: 'Brave New World', author: 'Aldous Huxley', year: 1932, coverUrl: coverUrl(8231823) },
  { title: 'The Midnight Library', author: 'Matt Haig', year: 2020, coverUrl: coverUrl(10313767) },
  { title: 'The Kite Runner', author: 'Khaled Hosseini', year: 2003, coverUrl: coverUrl(14846827) },
  { title: 'The Alchemist', author: 'Paulo Coelho', year: 1988, coverUrl: coverUrl(7414780) },
  { title: 'Jane Eyre', author: 'Charlotte Brontë', year: 1847, coverUrl: coverUrl(8235363) },
  { title: 'Frankenstein', author: 'Mary Shelley', year: 1818, coverUrl: coverUrl(12356249) },
  { title: 'Little Women', author: 'Louisa May Alcott', year: 1868, coverUrl: coverUrl(8775559) },
  { title: 'The Bell Jar', author: 'Sylvia Plath', year: 1963, coverUrl: coverUrl(8477115) },
];

type OpenLibraryDoc = {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
};

// Search any book in the Open Library catalogue (free, no API key).
export async function searchBooks(query: string, signal?: AbortSignal): Promise<Book[]> {
  const params = new URLSearchParams({
    q: query,
    fields: 'title,author_name,first_publish_year,cover_i',
    limit: '10',
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal });
  if (!res.ok) throw new Error(`Book search failed (${res.status})`);
  const data = (await res.json()) as { docs?: OpenLibraryDoc[] };

  const seen = new Set<string>();
  const books: Book[] = [];
  for (const doc of data.docs ?? []) {
    if (!doc.title) continue;
    const author = doc.author_name?.[0];
    const key = `${doc.title}|${author ?? ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    books.push({
      title: doc.title,
      author,
      year: doc.first_publish_year,
      coverUrl: coverUrl(doc.cover_i),
    });
  }
  return books;
}

// ── Recently discussed books ────────────────────────────────────────────────

const RECENT_BOOKS_KEY = 'bookcircle_recent_books';
const MAX_RECENT = 5;

export async function loadRecentBooks(): Promise<Book[]> {
  try {
    const saved = JSON.parse((await kvGet(RECENT_BOOKS_KEY)) ?? '[]') as unknown;
    return Array.isArray(saved)
      ? saved.filter((b): b is Book => !!b && typeof b.title === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function rememberBook(book: Book): Promise<void> {
  const recent = await loadRecentBooks();
  const others = recent.filter(
    (b) => b.title !== book.title || b.author !== book.author,
  );
  await kvSet(RECENT_BOOKS_KEY, JSON.stringify([book, ...others].slice(0, MAX_RECENT)));
}
