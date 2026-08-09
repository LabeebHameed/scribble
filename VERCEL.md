# Deploy Scribble on Vercel

## The one setting that matters

In [Project Settings → Build and Deployment](https://vercel.com/labeebs-projects-649a4343/scribble/settings):

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/web` |
| **Include source files outside of the Root Directory** | **On** |

That is it for project layout. There is no separate “Output Directory” field in the current Vercel UI for Next.js — you do not need to look for one.

Leaving Root Directory **blank** (repo root) is what causes the broken deploys. This repo is a monorepo; the Next.js app is in `apps/web`.

## Environment variables

In **Settings → Environment Variables**:

| Variable | Required |
|----------|----------|
| `DATABASE_URL` or `POSTGRES_URL` | Yes (from Neon) |
| `SETUP_SECRET` or `AUTH_SECRET` | Yes (for one-time `/api/setup`) |
| `NEXT_PUBLIC_APP_URL` | Yes (your Vercel URL) |
| `GROQ_API_KEY` | Yes for voice (Whisper STT + PlayAI TTS) |

Optional: `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` for richer chat; intents work offline without them.

## After deploy succeeds

Initialize the database (once):

```bash
curl -X POST https://YOUR-APP.vercel.app/api/setup \
  -H "x-setup-secret: YOUR_SETUP_SECRET"
```

## How to check if deploy worked

- Open your Vercel **Deployments** tab in the browser — do not use `vercel inspect` (it hangs without a login token).
- Or visit `https://YOUR-APP.vercel.app/api/health` — should return JSON with `"ok": true` after setup.

## Redeploy

After changing Root Directory to `apps/web`, click **Redeploy** on the latest `main` deployment.
