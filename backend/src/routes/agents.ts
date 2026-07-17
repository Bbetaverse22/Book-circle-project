import { Router, Request, Response } from 'express';
import { AGENTS, AGENT_LIST } from '../prompts';

const router = Router();

// GET /agents — list all agents (without systemPrompt)
router.get('/', (_req: Request, res: Response) => {
  const agents = AGENT_LIST.map(({ id, name, role, avatar, voiceId }) => ({
    id,
    name,
    role,
    avatar,
    voiceId,
  }));
  res.json({ agents });
});

// GET /agents/:id — get a single agent
router.get('/:id', (req: Request, res: Response) => {
  const agent = AGENTS[req.params.id];
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  const { id, name, role, avatar, voiceId } = agent;
  res.json({ id, name, role, avatar, voiceId });
});

// NOTE: POST /agents/:id/message was replaced by POST /club/ask, which fans
// out to all agents server-side. A per-agent public endpoint made usage
// accounting impossible (7 requests per question) and widened the abuse
// surface for API costs.

export default router;
