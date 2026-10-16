import Anthropic from '@anthropic-ai/sdk';
import { Agent } from '../prompts';
import { MAX_HISTORY_TURN_CHARS, MAX_HISTORY_TURNS } from '../config';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ConversationTurn = { role: 'user' | 'assistant'; content: string };
export type BookContext = { title: string; author?: string };

const MAX_BOOK_FIELD_CHARS = 200;

// Sanitize the client-supplied book the club is discussing. Returns undefined
// when missing or malformed so the agents fall back to their generic prompt.
export function sanitizeBook(book: unknown): BookContext | undefined {
  if (!book || typeof book !== 'object') return undefined;
  const { title, author } = book as { title?: unknown; author?: unknown };
  if (typeof title !== 'string' || !title.trim()) return undefined;
  return {
    title: title.trim().slice(0, MAX_BOOK_FIELD_CHARS),
    author:
      typeof author === 'string' && author.trim()
        ? author.trim().slice(0, MAX_BOOK_FIELD_CHARS)
        : undefined,
  };
}

function systemPromptFor(agent: Agent, book?: BookContext): string {
  if (!book) return agent.systemPrompt;
  const byline = book.author ? ` by ${book.author}` : '';
  return `${agent.systemPrompt}\n\nYour book club is currently discussing "${book.title}"${byline}. Assume every question is about this book unless the user clearly says otherwise.`;
}

// Sanitize client-supplied history: cap turn count and per-turn size,
// and drop anything that isn't a plain user/assistant text turn.
export function sanitizeHistory(history: unknown): ConversationTurn[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (turn): turn is ConversationTurn =>
        !!turn &&
        typeof turn === 'object' &&
        (turn.role === 'user' || turn.role === 'assistant') &&
        typeof turn.content === 'string',
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, MAX_HISTORY_TURN_CHARS),
    }));
}

export async function getAgentReply(
  agent: Agent,
  text: string,
  history: ConversationTurn[],
  book?: BookContext,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300, // agents answer in 2–3 sentences; keep output cost bounded
    system: systemPromptFor(agent, book),
    messages: [...history, { role: 'user', content: text }],
  });

  return response.content.find((b) => b.type === 'text')?.text ?? '';
}
