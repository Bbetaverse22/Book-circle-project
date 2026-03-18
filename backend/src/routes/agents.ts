import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { AGENTS, AGENT_LIST } from '../prompts';

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// POST /agents/:id/message
// Body: { text: string, history?: Array<{ role: 'user'|'assistant', content: string }> }
// Returns: { reply: string, agentId: string }
router.post('/:id/message', async (req: Request, res: Response) => {
  const agent = AGENTS[req.params.id];
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const { text, history = [] } = req.body as {
    text: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!text) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  try {
    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: 'user', content: text },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      system: agent.systemPrompt,
      messages,
    });

    const reply =
      response.content.find((b) => b.type === 'text')?.text ?? '';

    res.json({ reply, agentId: agent.id });
  } catch (error) {
    console.error(`Agent ${agent.id} response error:`, error);
    res.status(500).json({ error: 'Failed to get agent response' });
  }
});

export default router;
