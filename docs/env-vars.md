# Environment Variables — Stylo AI Backend

> **NEVER** commit `.env` files. All secrets must be set via Railway environment variables or local `.env` (gitignored).

## Required

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` / `production` |
| `PORT` | HTTP port | `3000` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@...` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | `stylo-ai-xxx` |
| `FIREBASE_ADMIN_SA_JSON` | Firebase Admin SDK service account JSON (minified) | `{"type":"service_account",...}` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | `abc123...` |
| `R2_ACCESS_KEY_ID` | R2 access key | `...` |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | `...` |
| `R2_BUCKET_WARDROBE` | Wardrobe images bucket name | `stylo-wardrobe` |
| `R2_BUCKET_TRYON` | Try-on results bucket name | `stylo-tryon` |
| `R2_BUCKET_AVATARS` | User avatars bucket name | `stylo-avatars` |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API key | `abc123` |

## Conditionally Required

| Variable | Condition | Description |
|---|---|---|
| `GEMINI_API_KEY` | `AI_PROVIDER=gemini` (default) | Google Gemini API key |
| `AI_SERVICE_URL` | `AI_PROVIDER=custom` | Custom AI service base URL |
| `AI_SERVICE_INTERNAL_KEY` | `AI_PROVIDER=custom` | Internal key for AI service |

## Optional — Secrets

| Variable | Description | Default |
|---|---|---|
| `ADMIN_TOKEN` | Bearer token for admin endpoints | — (admin disabled if not set) |
| `ANTHROPIC_API_KEY` | Claude API key (enrichment + detection) | — |
| `REPLICATE_API_TOKEN` | Replicate API token (try-on) | — |
| `APPLE_SHARED_SECRET` | Apple IAP shared secret | — |
| `GOOGLE_PLAY_SA_JSON` | Google Play service account JSON | — |
| `SENTRY_DSN_BACKEND` | Sentry DSN for error tracking | — |

## Optional — Configuration

| Variable | Description | Default |
|---|---|---|
| `AI_PROVIDER` | AI provider: `gemini` / `claude` / `openai` / `custom` | `gemini` |
| `APPLE_BUNDLE_ID` | iOS app bundle ID for IAP | — |
| `APPLE_ENVIRONMENT` | IAP environment: `sandbox` / `production` | `sandbox` |
| `GOOGLE_PLAY_PACKAGE_NAME` | Android package name for IAP | — |
| `R2_PUBLIC_BASE_URL` | Public CDN URL for R2 (e.g. `https://pub-xxx.r2.dev`) | — |
| `CORS_ORIGINS` | Comma-separated allowed CORS origins | Dev: open; Prod: blocked if not set |
| `STORAGE_MOCK` | Set `true` to skip real R2 calls (local dev) | `false` |

## Notes

- Secrets marked with `—` default are silently disabled (feature is off), not errors.
- `FIREBASE_ADMIN_SA_JSON` and `GOOGLE_PLAY_SA_JSON` should be the full JSON string on a single line.
- `ADMIN_TOKEN` should be a long random hex string (min 32 chars). Generate with: `openssl rand -hex 32`
- In production, set `CORS_ORIGINS` to the exact admin web origin(s), e.g. `https://admin.stylo-ai.com`.
- `ANTHROPIC_API_KEY` is required for garment attribute enrichment (OQ-BE-4) and extended detection. Without it, enrichment falls back silently.
