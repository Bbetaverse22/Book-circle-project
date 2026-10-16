#!/usr/bin/env bash
# BookCircle — one-command Cloud Run deploy.
#
# Run from the backend/ directory on a machine where you are logged into
# gcloud:   ./deploy.sh
#
# Reads API keys from backend/.env (never from the command line), enables the
# required Google Cloud services, creates the Firestore database if needed,
# and deploys the service. Safe to re-run — every step is idempotent.

set -euo pipefail

REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-bookcircle-api}"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────────────

cd "$(dirname "$0")"

command -v gcloud >/dev/null 2>&1 \
  || fail "gcloud CLI not found. Install it: https://cloud.google.com/sdk/docs/install"

gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q . \
  || fail "Not logged in. Run:  gcloud auth login"

PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
[ -n "$PROJECT" ] && [ "$PROJECT" != "(unset)" ] \
  || fail "No project set. Run:  gcloud config set project YOUR_FIREBASE_PROJECT_ID"

[ -f .env ] || fail "backend/.env not found. Copy .env.example and fill in your API keys."

# Load keys from .env without exporting everything to the environment.
get_env() { sed -n "s/^$1=//p" .env | tail -1; }

ANTHROPIC_API_KEY="$(get_env ANTHROPIC_API_KEY)"
OPENAI_API_KEY="$(get_env OPENAI_API_KEY)"
ELEVENLABS_API_KEY="$(get_env ELEVENLABS_API_KEY)"
REVENUECAT_API_KEY="$(get_env REVENUECAT_API_KEY)"
FREE_QUESTIONS_PER_DAY="$(get_env FREE_QUESTIONS_PER_DAY)"

for var in ANTHROPIC_API_KEY OPENAI_API_KEY ELEVENLABS_API_KEY; do
  [ -n "${!var}" ] || fail "$var is empty in backend/.env"
done

say "Deploying $SERVICE to project '$PROJECT' in $REGION"

# ── Enable services ──────────────────────────────────────────────────────────

say "Enabling required Google Cloud services (no-op if already enabled)…"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com

# ── Firestore database ───────────────────────────────────────────────────────

say "Ensuring Firestore database exists…"
if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create --location="$REGION" \
    || fail "Could not create the Firestore database. Create it once in the Firebase console (Native mode), then re-run."
else
  echo "Firestore database already exists."
fi

# ── Deploy ───────────────────────────────────────────────────────────────────

ENV_VARS="ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY},OPENAI_API_KEY=${OPENAI_API_KEY},ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}"
[ -n "$REVENUECAT_API_KEY" ]     && ENV_VARS="${ENV_VARS},REVENUECAT_API_KEY=${REVENUECAT_API_KEY}"
[ -n "$FREE_QUESTIONS_PER_DAY" ] && ENV_VARS="${ENV_VARS},FREE_QUESTIONS_PER_DAY=${FREE_QUESTIONS_PER_DAY}"

say "Building and deploying (first run takes a few minutes)…"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars "$ENV_VARS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"

# ── Done ─────────────────────────────────────────────────────────────────────

say "Deployed: $URL"
cat <<EOF

Smoke tests:
  curl $URL/health
  curl $URL/usage        # expect 401 (device ID required)
  curl -H "X-Device-Id: 12345678-1234-1234-1234-123456789012" $URL/usage

Next steps:
  1. Put this URL into frontend/eas.json (both REPLACE-WITH-CLOUD-RUN-URL spots)
  2. Continue with DEPLOYMENT.md Phase 2 (Apple Developer setup)
EOF
