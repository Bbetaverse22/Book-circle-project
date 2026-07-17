# 📚 BookCircle

**An AI book club in your pocket.** Pick a classic, ask a question out loud, and hear seven distinct characters discuss it with you — each replying in text *and* in their own voice.

## How it works

1. **You ask** — hold the mic button and speak (or just type). Your voice is transcribed by OpenAI Whisper.
2. **The club answers** — seven AI characters, each powered by Claude with their own personality, respond to your question about the book.
3. **They speak** — each reply is synthesized by ElevenLabs in that character's unique voice and played back in sequence, like sitting in a real book club.

### The club members

| Member | Role | Perspective |
|---|---|---|
| James | ER Nurse | Connects themes to real human experience |
| Maya | Teacher | Encouraging, asks thoughtful questions |
| Lily | Student | Bright, enthusiastic first reactions |
| Margaret | Homemaker | Emotional depth of characters, family life |
| Ahmed | English Learner | The beauty of language and culture |
| Dr. Chen | Literary Critic | Structural and thematic analysis |
| Marcus | Philosopher | Universal questions and existential themes |

## Architecture

```
┌──────────────────┐         ┌───────────────────────────┐
│  frontend/        │  HTTPS  │  backend/                  │
│  Expo React Native├────────►│  Express + TypeScript      │
│  (iOS · web)      │         │  (Cloud Run)               │
└──────────────────┘         └────────────┬──────────────┘
                                          │
                        ┌─────────────────┼─────────────────┐
                        ▼                 ▼                 ▼
                   Claude API       OpenAI Whisper     ElevenLabs TTS
                 (agent replies)   (transcription)   (character voices)
```

**Key endpoints** (all require an anonymous `X-Device-Id` header):

| Endpoint | Purpose |
|---|---|
| `POST /club/ask` | Fan a question out to all 7 agents server-side, return every reply |
| `POST /voice/transcribe` | Audio file → text (Whisper) |
| `POST /voice/synthesize` | Text → base64 audio in a character's voice |
| `GET /usage` | Current daily quota for the device |

Subscriptions are handled by RevenueCat (Apple In-App Purchase) against the same anonymous device ID — no user accounts required. Daily usage quotas live in Firestore.

## Local development

**Prerequisites:** Node 20+, npm, and either the [Expo Go](https://expo.dev/go) app on your phone or an iOS Simulator.

### Backend

```bash
cd backend
cp .env.example .env    # add your ANTHROPIC_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY
npm install
npm run dev             # http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npx expo start          # scan the QR code with Expo Go, or press i for the simulator
```

Dev conveniences: without Firebase credentials, usage quotas run in-memory (reset on restart); the paywall degrades to an informational notice in Expo Go and on web, where the RevenueCat native module isn't available.

> ⚠️ `.env` files hold real API keys and are gitignored — never commit them.

## Production & App Store

The full path from local prototype to the iOS App Store — Cloud Run deployment, Firestore, Apple Developer setup, RevenueCat subscription configuration, EAS builds, TestFlight, and the submission checklist — is documented step-by-step in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Security & cost controls

- Every API route requires an anonymous per-install device ID (`X-Device-Id`)
- Daily question quotas per device (free tier vs. subscriber), enforced server-side in Firestore
- Rate limiting for burst protection; request payload size and length caps
- TTS restricted to a whitelist of the club's voice IDs — the API can't be used as an open TTS proxy
- Agent replies capped at ~2–3 sentences (`max_tokens`) and synthesized with the cost-efficient `eleven_flash_v2_5` model

## Tech stack

- **App:** React Native · Expo SDK 51 · expo-router · expo-av · react-native-purchases
- **API:** Node 20 · Express · TypeScript · Docker on Google Cloud Run
- **Data:** Firestore (usage quotas) · RevenueCat (subscriptions)
- **AI:** Claude (Anthropic) · Whisper (OpenAI) · ElevenLabs TTS
