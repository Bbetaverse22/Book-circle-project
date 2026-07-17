import { Router, Request, Response, NextFunction } from 'express';
import OpenAI from 'openai';
import { ElevenLabsClient } from 'elevenlabs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AGENT_LIST } from '../prompts';
import { MAX_TTS_CHARS } from '../config';
import { usageLimit } from '../middleware/usageLimit';

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const uploadsDir = path.resolve(__dirname, '../../uploads');
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.webm';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Only voice IDs belonging to our agents may be synthesized — otherwise the
// endpoint could be used as a free TTS proxy for arbitrary ElevenLabs voices.
const ALLOWED_VOICE_IDS = new Set(AGENT_LIST.map((a) => a.voiceId));

// POST /voice/transcribe
// Receives audio file, returns transcribed text via OpenAI Whisper
router.post(
  '/transcribe',
  usageLimit('transcribe'),
  upload.single('audio'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(req.file.path),
        model: 'whisper-1',
      });
      fs.unlinkSync(req.file.path);
      res.json({ text: transcription.text });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error('Transcription error:', error);
      res.status(500).json({ error: 'Transcription failed' });
    }
  },
);

// POST /voice/synthesize
// Receives { text, voiceId, agentId }, returns { audio: base64 } JSON
const OPENAI_VOICE_BY_AGENT: Record<string, 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'> = {
  james: 'onyx',
  maya: 'nova',
  lily: 'shimmer',
  margaret: 'fable',
  ahmed: 'echo',
  drchen: 'alloy',
  marcus: 'onyx',
};

async function synthesizeWithOpenAI(text: string, agentId?: string): Promise<string> {
  const voice = OPENAI_VOICE_BY_AGENT[agentId ?? ''] ?? 'alloy';
  const speech = await openai.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
  });
  const buffer = Buffer.from(await speech.arrayBuffer());
  return buffer.toString('base64');
}

async function synthesizeWithElevenLabs(text: string, voiceId: string): Promise<string> {
  const stream = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    // Flash model: ~50% of the credit cost of multilingual_v2 and lower
    // latency — quality is plenty for short conversational lines.
    model_id: 'eleven_flash_v2_5',
  });
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('base64');
}

// Validate BEFORE usageLimit so malformed requests never burn quota.
function validateSynthesize(req: Request, res: Response, next: NextFunction): void {
  const { text, voiceId } = req.body as { text?: unknown; voiceId?: unknown };
  if (typeof text !== 'string' || !text.trim() || typeof voiceId !== 'string') {
    res.status(400).json({ error: 'text and voiceId are required' });
    return;
  }
  if (!ALLOWED_VOICE_IDS.has(voiceId)) {
    res.status(400).json({ error: 'Unknown voiceId' });
    return;
  }
  next();
}

router.post('/synthesize', validateSynthesize, usageLimit('tts'), async (req: Request, res: Response) => {
  const { text, voiceId, agentId } = req.body as {
    text: string;
    voiceId: string;
    agentId?: string;
  };

  // Cost cap: agent replies are 2–3 sentences; anything longer is truncated
  // rather than rejected so playback still works.
  const speechText = text.slice(0, MAX_TTS_CHARS);

  try {
    const audio = await synthesizeWithElevenLabs(speechText, voiceId);
    res.json({ audio, provider: 'elevenlabs' });
  } catch (elevenLabsError) {
    console.warn('ElevenLabs synthesis failed, falling back to OpenAI TTS:', elevenLabsError);
    try {
      const audio = await synthesizeWithOpenAI(speechText, agentId);
      res.json({ audio, provider: 'openai' });
    } catch (openAiError) {
      console.error('OpenAI TTS synthesis error:', openAiError);
      res.status(500).json({ error: 'Voice synthesis failed' });
    }
  }
});

export default router;
