import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { ElevenLabsClient } from 'elevenlabs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const upload = multer({
  dest: path.resolve(__dirname, '../../uploads'),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// POST /voice/transcribe
// Receives audio file, returns transcribed text via OpenAI Whisper
router.post(
  '/transcribe',
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
// Receives { text, voiceId }, returns { audio: base64 } JSON
router.post('/synthesize', async (req: Request, res: Response) => {
  const { text, voiceId } = req.body as { text: string; voiceId: string };
  if (!text || !voiceId) {
    res.status(400).json({ error: 'text and voiceId are required' });
    return;
  }
  try {
    const stream = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      model_id: 'eleven_multilingual_v2',
    });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    res.json({ audio: Buffer.concat(chunks).toString('base64') });
  } catch (error) {
    console.error('Voice synthesis error:', error);
    res.status(500).json({ error: 'Voice synthesis failed' });
  }
});

export default router;
