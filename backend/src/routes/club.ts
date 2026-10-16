import { Router, Request, Response, NextFunction } from 'express';
import { MAX_QUESTION_CHARS, MAX_REPLIES_PER_QUESTION } from '../config';
import { usageLimit } from '../middleware/usageLimit';
import {
  ClubMessage,
  getMemberReply,
  pickNextSpeaker,
  sanitizeBook,
  sanitizeMembers,
  sanitizeTranscript,
} from '../services/agentChat';

const router = Router();

// The club is a group chat between the reader and the members they picked.
// Each reply is its own request so the app can show and speak it before the
// next member decides whether to add something:
//
//   POST /club/ask       reader's message → the first member's answer
//   POST /club/followup  → another member's addition, or { done: true }
//
// Both take { members: string[3], book?, transcript: ClubMessage[] }.

type ClubBody = { members?: unknown; book?: unknown; transcript?: unknown; text?: unknown };

// Validate BEFORE usageLimit so malformed requests never burn quota.
function validateClub(req: Request, res: Response, next: NextFunction): void {
  const members = sanitizeMembers((req.body as ClubBody).members);
  if (!members) {
    res.status(400).json({ error: 'members must be 3 distinct club member ids' });
    return;
  }
  res.locals.members = members;
  res.locals.book = sanitizeBook((req.body as ClubBody).book);
  res.locals.transcript = sanitizeTranscript((req.body as ClubBody).transcript, members);
  next();
}

function validateAsk(req: Request, res: Response, next: NextFunction): void {
  const { text } = req.body as ClubBody;
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  if (text.length > MAX_QUESTION_CHARS) {
    res.status(400).json({
      error: `text must be at most ${MAX_QUESTION_CHARS} characters`,
    });
    return;
  }
  next();
}

async function reply(res: Response, transcript: ClubMessage[], mustAnswer: boolean) {
  const { members, book } = res.locals;
  const speaker = await pickNextSpeaker(members, transcript, book, mustAnswer);
  if (!speaker) return null;
  const text = await getMemberReply(speaker, members, transcript, book);
  return text ? { speaker, text } : null;
}

// One reader message = one "question" against the daily quota.
router.post(
  '/ask',
  validateClub,
  validateAsk,
  usageLimit('questions'),
  async (req: Request, res: Response) => {
    const transcript: ClubMessage[] = [
      ...res.locals.transcript,
      { speaker: 'user', text: (req.body as { text: string }).text.trim() },
    ];
    try {
      const message = await reply(res, transcript, true);
      if (!message) throw new Error('Empty reply');
      res.json({ message, usage: res.locals.usage });
    } catch (error) {
      console.error('Club ask error:', error);
      res.status(502).json({ error: 'The club could not respond' });
    }
  },
);

// Follow-ups draw on a separate daily "turns" quota, and stop once the
// members have replied MAX_REPLIES_PER_QUESTION times since the reader spoke.
router.post(
  '/followup',
  validateClub,
  usageLimit('turns'),
  async (_req: Request, res: Response) => {
    const transcript: ClubMessage[] = res.locals.transcript;
    const lastUser = transcript.map((m) => m.speaker).lastIndexOf('user');
    const repliesSinceUser = transcript.length - 1 - lastUser;
    if (lastUser === -1 || repliesSinceUser < 1 || repliesSinceUser >= MAX_REPLIES_PER_QUESTION) {
      res.json({ done: true });
      return;
    }
    try {
      const message = await reply(res, transcript, false);
      res.json(message ? { message } : { done: true });
    } catch (error) {
      console.error('Club follow-up error:', error);
      res.json({ done: true });
    }
  },
);

export default router;
