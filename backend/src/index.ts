import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import voiceRoutes from './routes/voice';
import agentRoutes from './routes/agents';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use(cors());
app.use(express.json());

app.use('/voice', voiceRoutes);
app.use('/agents', agentRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`BookCircle API running on port ${PORT}`);
});
