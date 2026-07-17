# BookCircle — Production Deployment Guide

From working prototype to the iOS App Store. Steps are in order; each phase
depends on the previous one.

---

## Phase 1 — Deploy the backend to Cloud Run

Uses your existing Firebase/Google account. One-time setup ~20 minutes.

### 1.1 Prerequisites
- Install the gcloud CLI: https://cloud.google.com/sdk/docs/install
- Your Firebase project must be on the **Blaze (pay-as-you-go)** plan
  (Firebase console → gear icon → Usage and billing). The free monthly
  quotas cover early usage, so this typically costs $0 at launch.

### 1.2 Deploy

```bash
gcloud auth login
gcloud config set project YOUR_FIREBASE_PROJECT_ID

# Enable required services (first time only)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com

# Create the Firestore database if you haven't (Native mode)
gcloud firestore databases create --location=us-central1

# Deploy from the repo root
gcloud run deploy bookcircle-api \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "ANTHROPIC_API_KEY=sk-ant-...,OPENAI_API_KEY=sk-...,ELEVENLABS_API_KEY=...,REVENUECAT_API_KEY=sk_...(after Phase 3)"
```

> Tip: for better secret hygiene, use Secret Manager instead of
> `--set-env-vars`: `gcloud run services update bookcircle-api
> --set-secrets "ANTHROPIC_API_KEY=anthropic-key:latest"` etc.

### 1.3 Verify

```bash
API=https://bookcircle-api-xxxxx.run.app   # printed by the deploy

curl $API/health                            # → {"status":"ok"}
curl $API/usage                             # → 401 (device ID required) ✓ protected
curl -H "X-Device-Id: 12345678-1234-1234-1234-123456789012" $API/usage
# → {"isSubscriber":false,"questions":{"used":0,"limit":3,"remaining":3}}
```

Then put the URL into `frontend/eas.json` (replace both
`REPLACE-WITH-CLOUD-RUN-URL` placeholders).

Usage data appears in Firestore under the `usage` collection
(one doc per device per day, auto-created).

---

## Phase 2 — Apple Developer setup

1. Enroll in the Apple Developer Program ($99/yr): https://developer.apple.com/programs/enroll/
2. In **App Store Connect** (https://appstoreconnect.apple.com):
   - My Apps → **+** → New App
   - Platform iOS, Bundle ID `com.bookcircle.app` (register it under
     Certificates → Identifiers first if prompted)
3. Create the subscription:
   - Your app → Monetization → Subscriptions → create a Subscription Group
     (e.g. "BookCircle Plus")
   - Add an Auto-Renewable Subscription, e.g. product ID
     `bookcircle_plus_monthly`, monthly, pick your price (e.g. $4.99)
   - Fill in the localized display name + description; add review notes

---

## Phase 3 — RevenueCat setup

RevenueCat handles receipt validation and gives the backend a clean
subscription-status API. Free below $2.5k/month revenue.

1. Create an account at https://app.revenuecat.com
2. Create a Project → add an **App Store** app with bundle ID
   `com.bookcircle.app`; connect it to App Store Connect with an
   In-App Purchase key (RevenueCat's wizard walks you through it)
3. Products → import `bookcircle_plus_monthly`
4. Entitlements → create one with identifier **`premium`** and attach the
   product to it (the identifier must match `REVENUECAT_ENTITLEMENT_ID` on
   the backend and `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT` in the app)
5. Offerings → make a `default` offering containing the monthly package
6. Collect two keys:
   - **Public Apple API key** (`appl_...`) → `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
     in `eas.json` env or `frontend/.env`
   - **Secret API key** (`sk_...`) → `REVENUECAT_API_KEY` on Cloud Run:
     ```bash
     gcloud run services update bookcircle-api --update-env-vars "REVENUECAT_API_KEY=sk_..."
     ```

How it fits together: the app logs into RevenueCat with the same anonymous
device ID it sends to the backend, so `GET /v1/subscribers/{deviceId}` on the
backend reflects purchases automatically. No user accounts needed.

---

## Phase 4 — Build & TestFlight

```bash
npm install -g eas-cli
cd frontend
eas login                       # your Expo account
eas build:configure             # links the project (creates projectId)

# Internal test build on your iPhone
eas build --platform ios --profile preview

# Production build + submit to App Store Connect
eas build --platform ios --profile production
eas submit --platform ios
```

Test on TestFlight before submitting for review:
- Record → transcribe → 7 responses → sequential voices
- Burn through the free questions → paywall appears
- **Sandbox purchase** (TestFlight uses the sandbox automatically) unlocks
  unlimited questions; "Restore purchases" works after reinstall
- Onboarding shows exactly once

---

## Phase 5 — App Store submission checklist

Required before hitting "Submit for Review":

- [ ] **Privacy policy URL** — host a simple page (GitHub Pages is fine).
      Must cover: voice recordings are sent to the server for transcription
      and not stored; anonymous device ID + usage counts are stored;
      third-party processors (Anthropic, OpenAI, ElevenLabs, RevenueCat).
- [ ] **Support URL** — a contact page or even a GitHub repo link
- [ ] **App Privacy questionnaire** (App Store Connect): declare
      "Audio Data" (app functionality, not linked to identity),
      "Identifiers → Device ID" (app functionality), "Usage Data"
- [ ] **Screenshots** — 6.9" and 6.5" iPhone sizes (take them in Simulator:
      home, chat with responses, paywall)
- [ ] **Age rating** questionnaire (book discussion → likely 12+)
- [ ] **Review notes** — explain: "Responses are AI-generated characters
      discussing classic literature (Claude by Anthropic with safety
      filtering). Voice input is transcribed via speech-to-text. Demo: pick
      any book, ask 'What did you think of the ending?'"
- [ ] Subscription metadata complete (App Store Connect rejects the binary
      review until the subscription itself is reviewable)

---

## Costs

| Item | Cost |
|---|---|
| Apple Developer Program | $99/year |
| Cloud Run + Firestore | ~$0 at low traffic (free tier) |
| RevenueCat | Free < $2.5k/mo tracked revenue |
| Claude + Whisper + ElevenLabs | Per-use; capped by free tier (3 questions/device/day) |

Rough per-question cost: 7 Claude calls (~300 tokens out each) + 7 flash TTS
clips ≈ $0.03–0.08. Set your subscription price with that in mind
(a heavy subscriber asking 30 questions/day ≈ $1–2.50/day — the
`SUBSCRIBER_QUESTIONS_PER_DAY` cap on Cloud Run protects the worst case).

---

## Environment variable reference

**Cloud Run (backend)**

| Var | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Agent replies |
| `OPENAI_API_KEY` | ✅ | Whisper + TTS fallback |
| `ELEVENLABS_API_KEY` | ✅ | Character voices |
| `REVENUECAT_API_KEY` | for subs | Secret key `sk_...` |
| `REVENUECAT_ENTITLEMENT_ID` | – | default `premium` |
| `FREE_QUESTIONS_PER_DAY` | – | default 3 |
| `SUBSCRIBER_QUESTIONS_PER_DAY` | – | default 200 |

**EAS / frontend**

| Var | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✅ | Cloud Run URL (set in eas.json) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | for subs | Public key `appl_...` |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT` | – | default `premium` |
