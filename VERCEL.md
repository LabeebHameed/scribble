# Vercel deployment (required settings)

Scribble is a **pnpm + Turborepo** monorepo. The Next.js app lives in `apps/web`, not the repo root.

## Root Directory — this is the fix

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/web` |
| **Include source files outside of the Root Directory** | ✅ **On** |

Leaving Root Directory **blank** (repo root) is wrong for this project and causes errors like:

> No Output Directory named "public" found

## Build & Deployment

Open: https://vercel.com/labeebs-projects-649a4343/scribble/settings

| Setting | Value |
|---------|--------|
| **Framework Preset** | Next.js |
| **Build Command** | *(leave empty — uses `apps/web/vercel.json`)* |
| **Output Directory** | *(leave empty — must NOT be `public`)* |
| **Install Command** | *(leave empty)* |

If any setting has an **Override** toggle turned on with a custom value, turn it **off** unless noted above.

## Environment variables

| Variable | Required |
|----------|----------|
| `DATABASE_URL` or `POSTGRES_URL` | ✅ (from Neon integration) |
| `AUTH_SECRET` | ✅ |
| `NEXT_PUBLIC_APP_URL` | ✅ (your Vercel URL) |
| `OPENAI_API_KEY` | optional |

## After first successful deploy

```bash
curl -X POST https://YOUR-APP.vercel.app/api/setup \
  -H "x-setup-secret: YOUR_AUTH_SECRET"
```

Then open the app and log in: `demo@scribble.app` / `scribble`

## Redeploy

After changing Root Directory to `apps/web`, click **Redeploy** on the latest deployment (or push a new commit to `main`).
