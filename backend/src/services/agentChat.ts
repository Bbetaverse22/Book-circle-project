import Anthropic from '@anthropic-ai/sdk';
import { Agent, AGENTS } from '../prompts';
import { CLUB_SIZE, MAX_HISTORY_TURN_CHARS, MAX_HISTORY_TURNS } from '../config';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Members speak with this model; the moderator that picks who talks next
// only outputs a single id, so it runs at low effort.
const MEMBER_MODEL = 'claude-opus-4-6';
const MODERATOR_MODEL = 'claude-opus-5-5';

export type BookContext = { title: string; author?: string };

// One line of the club's group chat. `speaker` is 'user' or a member id.
export type ClubMessage = { speaker: string; text: string };

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

// Returns exactly CLUB_SIZE distinct, known member ids, or null.
export function sanitizeMembers(members: unknown): string[] | null {
  if (!Array.isArray(members)) return null;
  const ids = [...new Set(members.filter((m): m is string => typeof m === 'string'))];
  if (ids.length !== CLUB_SIZE || !ids.every((id) => AGENTS[id])) return null;
  return ids;
}

// Keep only well-formed lines from the user or this club's members, capped
// in count and size.
export function sanitizeTranscript(transcript: unknown, members: string[]): ClubMessage[] {
  if (!Array.isArray(transcript)) return [];
  return transcript
    .filter(
      (m): m is ClubMessage =>
        !!m &&
        typeof m === 'object' &&
        typeof m.text === 'string' &&
        typeof m.speaker === 'string' &&
        (m.speaker === 'user' || members.includes(m.speaker)),
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ speaker: m.speaker, text: m.text.slice(0, MAX_HISTORY_TURN_CHARS) }));
}

function speakerName(speaker: string): string {
  return speaker === 'user' ? 'Reader' : (AGENTS[speaker]?.name ?? speaker);
}

function bookLine(book?: BookContext): string {
  if (!book) return 'a book the reader picked';
  return `"${book.title}"${book.author ? ` by ${book.author}` : ''}`;
}

function memberSystemPrompt(agent: Agent, members: string[], book?: BookContext): string {
  const others = members
    .filter((id) => id !== agent.id)
    .map((id) => `${AGENTS[id].name} (${AGENTS[id].role})`)
    .join(' and ');
  return `${agent.systemPrompt}

You are in a small, live book club discussing ${bookLine(book)}. The others here are the reader (the person who started the club) and ${others}. Assume everything is about this book unless someone clearly says otherwise. The reader may pick any book, including recent or lesser-known ones: if you don't know it well, say so honestly and ask the reader about it rather than inventing plot details, characters or quotes.

This is a spoken back-and-forth, not a speech: usually 1-2 sentences, under 50 words, the way people talk out loud. Plain text only — no markdown, asterisks or lists. When someone else just spoke, react to them by name instead of repeating what was already said. Real book clubs disagree: if your character would see it differently, say so plainly rather than agreeing to be nice. Speak to the reader as "you". Don't start with your own name and don't narrate actions.`;
}

// Turn the group chat into one member's view: their own lines are the
// assistant turns, everyone else's are user turns labelled with the speaker.
function memberMessages(agent: Agent, transcript: ClubMessage[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  for (const line of transcript) {
    const role = line.speaker === agent.id ? 'assistant' : 'user';
    const content = role === 'assistant' ? line.text : `${speakerName(line.speaker)}: ${line.text}`;
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content as string}\n\n${content}`;
    } else {
      messages.push({ role, content });
    }
  }
  if (messages[0]?.role === 'assistant') {
    messages.unshift({ role: 'user', content: '(The book club conversation so far.)' });
  }
  return messages;
}

export async function getMemberReply(
  agentId: string,
  members: string[],
  transcript: ClubMessage[],
  book?: BookContext,
): Promise<string> {
  const agent = AGENTS[agentId];
  const response = await anthropic.messages.create({
    model: MEMBER_MODEL,
    max_tokens: 300, // spoken replies are 1–3 sentences; keep output cost bounded
    system: memberSystemPrompt(agent, members, book),
    messages: memberMessages(agent, transcript),
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  // Replies are read aloud and shown as plain text, so drop stray markdown.
  return text.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1').trim();
}

// Names the reader addressed directly in their latest message, e.g. "Maya, ..."
function addressedMember(text: string, members: string[]): string | undefined {
  const lower = text.toLowerCase();
  return members.find((id) => {
    const name = AGENTS[id].name.toLowerCase();
    const firstName = name.replace(/^dr\.\s*/, '');
    return new RegExp(`\\b(${name.replace('.', '\\.')}|${firstName})\\b`).test(lower);
  });
}

// Decide who speaks next. With `mustAnswer` (right after the reader spoke)
// someone always replies; otherwise the moderator may hand the floor back to
// the reader by returning null. Never picks whoever spoke last.
export async function pickNextSpeaker(
  members: string[],
  transcript: ClubMessage[],
  book: BookContext | undefined,
  mustAnswer: boolean,
): Promise<string | null> {
  const last = transcript[transcript.length - 1];
  const candidates = members.filter((id) => id !== last?.speaker);
  if (candidates.length === 0) return null;

  if (mustAnswer && last?.speaker === 'user') {
    const addressed = addressedMember(last.text, candidates);
    if (addressed) return addressed;
  }

  const roster = candidates
    .map((id) => `- ${id}: ${AGENTS[id].name}, ${AGENTS[id].role}`)
    .join('\n');
  const chat = transcript.map((m) => `${speakerName(m.speaker)}: ${m.text}`).join('\n');
  const rule = mustAnswer
    ? 'The reader just spoke, so one member must answer. Pick the member best suited to answer first, or the one the reader addressed.'
    : `Pick a member only if they would naturally jump in right now: someone addressed them, they disagree, or their background gives a clearly different angle. Usually one other member reacts to the first answer; a third voice should join only for a real disagreement or a genuinely new point, and the reader should normally get the floor back after two or three replies. Reply "none" if the last speaker asked the reader something, if the point has been made, or if another reply would mostly agree or repeat.`;

  try {
    const response = await anthropic.messages.create({
      model: MODERATOR_MODEL,
      max_tokens: 1024,
      // Not in this SDK version's types; the API reads it from the body.
      ...({ output_config: { effort: 'low' } } as object),
      system: `You moderate a small book club discussing ${bookLine(book)}. You never speak yourself; you only choose who talks next so the conversation feels natural.`,
      messages: [
        {
          role: 'user',
          content: `Members who could speak next:\n${roster}\n\nConversation:\n${chat}\n\n${rule}\n\nReply with only one id from the list${mustAnswer ? '' : ' or "none"'}.`,
        },
      ],
    });
    const answer = (response.content.find((b) => b.type === 'text')?.text ?? '')
      .trim()
      .toLowerCase();
    const picked = candidates.find((id) => answer.includes(id));
    if (picked) return picked;
    if (!mustAnswer) return null;
  } catch (error) {
    console.error('Moderator failed:', error);
    if (!mustAnswer) return null;
  }
  // Fall back to a random member so the reader always gets an answer.
  return candidates[Math.floor(Math.random() * candidates.length)];
}
