import { Router, Request, Response, NextFunction } from 'express';
import { AGENT_LIST } from '../prompts';
import { MAX_QUESTION_CHARS } from '../config';
import { usageLimit } from '../middleware/usageLimit';
import { getAgentReply, sanitizeHistory } from '../services/agentChat';

const router = Router();

// Validate BEFORE usageLimit so malformed requests never burn quota.
function validateAsk(req: Request, res: Response, next: NextFunction): void {
  const { text } = req.body as { text?: unknown };
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

// POST /club/ask
// Body: { text: string, history?: ConversationTurn[] }
// Fans the question out to all agents server-side and returns every reply.
// One request = one "question" against the device's daily quota, which makes
// usage accounting airtight (no way to spend quota per-agent).
router.post('/ask', validateAsk, usageLimit('questions'), async (req: Request, res: Response) => {
  const { text, history } = req.body as { text: string; history?: unknown };

  const cleanHistory = sanitizeHistory(history);

  const responses = await Promise.all(
    AGENT_LIST.map(async (agent) => {
      try {
        const reply = await getAgentReply(agent, text.trim(), cleanHistory);
        return { agentId: agent.id, text: reply };
      } catch (error) {
        console.error(`Agent ${agent.id} response error:`, error);
        return { agentId: agent.id, text: '', error: true as const };
      }
    }),
  );

  // If every agent failed, surface it as a server error instead of an
  // empty-looking success.
  if (responses.every((r) => 'error' in r)) {
    res.status(502).json({ error: 'All agents failed to respond' });
    return;
  }

  res.json({ responses, usage: res.locals.usage });
});

export default router;
