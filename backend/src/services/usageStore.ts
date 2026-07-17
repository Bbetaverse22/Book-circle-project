// Daily usage tracking per device.
//
// Uses Firestore when available (production on Cloud Run, or locally with
// GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_PROJECT_ID set). Falls back to an
// in-memory store for local development so the backend runs without any
// Firebase setup.

export type UsageCategory = 'questions' | 'tts' | 'transcribe';

export interface UsageSnapshot {
  used: number;
  limit: number;
  remaining: number;
}

interface UsageBackend {
  /**
   * Atomically increment `category` for the device if under `limit`.
   * Returns the snapshot after the attempt; `allowed` is false when the
   * limit was already reached (no increment happens in that case).
   */
  consume(
    deviceId: string,
    date: string,
    category: UsageCategory,
    limit: number,
  ): Promise<{ allowed: boolean } & UsageSnapshot>;

  peek(deviceId: string, date: string, category: UsageCategory, limit: number): Promise<UsageSnapshot>;
}

// ── In-memory backend (local dev fallback) ──────────────────────────────────

class MemoryBackend implements UsageBackend {
  private counts = new Map<string, number>();

  private key(deviceId: string, date: string, category: UsageCategory) {
    return `${deviceId}:${date}:${category}`;
  }

  async consume(deviceId: string, date: string, category: UsageCategory, limit: number) {
    const key = this.key(deviceId, date, category);
    const used = this.counts.get(key) ?? 0;
    if (used >= limit) {
      return { allowed: false, used, limit, remaining: 0 };
    }
    this.counts.set(key, used + 1);
    return { allowed: true, used: used + 1, limit, remaining: limit - used - 1 };
  }

  async peek(deviceId: string, date: string, category: UsageCategory, limit: number) {
    const used = this.counts.get(this.key(deviceId, date, category)) ?? 0;
    return { used, limit, remaining: Math.max(0, limit - used) };
  }
}

// ── Firestore backend ────────────────────────────────────────────────────────

class FirestoreBackend implements UsageBackend {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  private docRef(deviceId: string, date: string) {
    return this.db.collection('usage').doc(`${deviceId}_${date}`);
  }

  async consume(deviceId: string, date: string, category: UsageCategory, limit: number) {
    const ref = this.docRef(deviceId, date);
    return this.db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const used: number = snap.exists ? (snap.data()?.[category] ?? 0) : 0;
      if (used >= limit) {
        return { allowed: false, used, limit, remaining: 0 };
      }
      tx.set(ref, { deviceId, date, [category]: used + 1 }, { merge: true });
      return { allowed: true, used: used + 1, limit, remaining: limit - used - 1 };
    });
  }

  async peek(deviceId: string, date: string, category: UsageCategory, limit: number) {
    const snap = await this.docRef(deviceId, date).get();
    const used: number = snap.exists ? (snap.data()?.[category] ?? 0) : 0;
    return { used, limit, remaining: Math.max(0, limit - used) };
  }
}

// ── Backend selection ────────────────────────────────────────────────────────

let backend: UsageBackend | null = null;

function getBackend(): UsageBackend {
  if (backend) return backend;

  const hasFirebaseConfig =
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    !!process.env.FIREBASE_PROJECT_ID ||
    // Cloud Run / GCP provide default credentials + project automatically.
    !!process.env.K_SERVICE;

  if (hasFirebaseConfig) {
    try {
      // Lazy require so local dev without firebase-admin config still works.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const admin = require('firebase-admin');
      if (admin.apps.length === 0) {
        admin.initializeApp(
          process.env.FIREBASE_PROJECT_ID
            ? { projectId: process.env.FIREBASE_PROJECT_ID }
            : undefined,
        );
      }
      backend = new FirestoreBackend(admin.firestore());
      console.log('Usage tracking: Firestore');
      return backend;
    } catch (error) {
      console.warn('Firestore unavailable, falling back to in-memory usage tracking:', error);
    }
  }

  backend = new MemoryBackend();
  console.log('Usage tracking: in-memory (local dev — counts reset on restart)');
  return backend;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function consumeUsage(
  deviceId: string,
  category: UsageCategory,
  limit: number,
): Promise<{ allowed: boolean } & UsageSnapshot> {
  return getBackend().consume(deviceId, todayUtc(), category, limit);
}

export function peekUsage(
  deviceId: string,
  category: UsageCategory,
  limit: number,
): Promise<UsageSnapshot> {
  return getBackend().peek(deviceId, todayUtc(), category, limit);
}
