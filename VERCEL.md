# Vercel deployment (required settings)

Scribble is a **pnpm + Turborepo** monorepo. The Next.js app lives in `apps/web`, not the repo root.

## Root Directory (read this)

| Your situation | What to set |
|----------------|-------------|
| **Recommended** | Root Directory = `apps/web` |
| **Currently using repo root** | Leave blank — `vercel.json` at repo root handles it |

**Yes, leaving Root Directory blank (repo root) is a common cause of failures** if `vercel.json` / framework settings are wrong. This repo now supports **both** layouts.

### If using repo root (blank Root Directory)

1. Clear **Output Directory** override (must be blank, not `public`)
2. **Framework Preset** → Next.js
3. Neon + `AUTH_SECRET` + `NEXT_PUBLIC_APP_URL`

### If using `apps/web` (recommended)

1. Root Directory → `apps/web`
2. Enable **Include source files outside of the Root Directory**
3. Clear **Output Directory** override
4. Same env vars as above

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
