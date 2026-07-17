import Anthropic from '@anthropic-ai/sdk';
import { Agent } from '../prompts';
import { MAX_HISTORY_TURN_CHARS, MAX_HISTORY_TURNS } from '../config';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ConversationTurn = { role: 'user' | 'assistant'; content: string };

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
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300, // agents answer in 2–3 sentences; keep output cost bounded
    system: agent.systemPrompt,
    messages: [...history, { role: 'user', content: text }],
  });

  return response.content.find((b) => b.type === 'text')?.text ?? '';
}
