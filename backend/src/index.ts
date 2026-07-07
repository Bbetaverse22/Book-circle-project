import './env';
import express from 'express';
import cors from 'cors';
import voiceRoutes from './routes/voice';
import agentRoutes from './routes/agents';
import fs from 'fs';
import path from 'path';

const REQUIRED_ENV_VARS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY'] as const;
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT ?? 3000;

const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());

app.use('/voice', voiceRoutes);
app.use('/agents', agentRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`BookCircle API running on port ${PORT}`);
});
