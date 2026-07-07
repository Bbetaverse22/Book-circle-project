import './env';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import voiceRoutes from './routes/voice';
import agentRoutes from './routes/agents';
import clubRoutes from './routes/club';
import { deviceAuth } from './middleware/deviceAuth';
import { dailyLimits } from './config';
import { isSubscriber } from './services/entitlements';
import { peekUsage } from './services/usageStore';
import fs from 'fs';
import path from 'path';

const REQUIRED_ENV_VARS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY'] as const;
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (!process.env.REVENUECAT_API_KEY) {
  console.warn('REVENUECAT_API_KEY not set — all devices treated as free tier.');
}

const app = express();
const PORT = process.env.PORT ?? 3000;

// Cloud Run sits behind a single proxy layer; needed for correct client IPs.
app.set('trust proxy', 1);

const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Burst protection: keyed by device where available, IP otherwise.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.header('x-device-id') ?? req.ip ?? 'unknown',
});
app.use(limiter);

// Health check stays public (Cloud Run uses it); everything else requires a
// device identity.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(deviceAuth);

// GET /usage — current daily quota for this device (drives the app's
// "N free questions left" counter and paywall state).
app.get('/usage', async (req, res) => {
  const subscribed = await isSubscriber(req.deviceId);
  const limits = dailyLimits(subscribed);
  const questions = await peekUsage(req.deviceId, 'questions', limits.questions);
  res.json({ isSubscriber: subscribed, questions });
});

app.use('/voice', voiceRoutes);
app.use('/agents', agentRoutes);
app.use('/club', clubRoutes);

app.listen(PORT, () => {
  console.log(`BookCircle API running on port ${PORT}`);
});
