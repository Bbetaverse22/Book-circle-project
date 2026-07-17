// Central knobs for usage limits and cost caps.
// All overridable via environment variables.

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const AGENT_COUNT = 7;

// Free tier: questions per device per day.
export const FREE_QUESTIONS_PER_DAY = intFromEnv('FREE_QUESTIONS_PER_DAY', 3);

// Subscriber tier: generous but bounded (protects against abuse of a single account).
export const SUBSCRIBER_QUESTIONS_PER_DAY = intFromEnv('SUBSCRIBER_QUESTIONS_PER_DAY', 200);

// Derived per-category daily caps (per device).
export function dailyLimits(isSubscriber: boolean) {
  const questions = isSubscriber ? SUBSCRIBER_QUESTIONS_PER_DAY : FREE_QUESTIONS_PER_DAY;
  return {
    questions,
    // 7 TTS clips per question, plus headroom for retries.
    tts: questions * AGENT_COUNT + AGENT_COUNT,
    // A few transcription attempts per question.
    transcribe: questions * 3,
  };
}

// Cost caps on request payloads.
export const MAX_QUESTION_CHARS = 1000; // user question sent to agents
export const MAX_TTS_CHARS = 600; // 2–3 sentences comfortably fits
export const MAX_HISTORY_TURNS = 20; // conversation turns forwarded to Claude
export const MAX_HISTORY_TURN_CHARS = 4000;

// RevenueCat entitlement identifier (configure in the RevenueCat dashboard).
export const ENTITLEMENT_ID = process.env.REVENUECAT_ENTITLEMENT_ID ?? 'premium';
