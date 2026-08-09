# Vercel deployment — read this first

## What should Root Directory be?

| Setting | When to use |
|---------|-------------|
| **`apps/web`** | **Recommended** — use this if you can change it |
| **Blank (repo root)** | Works too — leave as-is if you already have it blank |

**Both are supported.** Pick one and follow the matching row below.

---

## Option A — Root Directory = `apps/web` (recommended)

Open: https://vercel.com/labeebs-projects-649a4343/scribble/settings

| Setting | Value |
|---------|--------|
| Root Directory | `apps/web` |
| Include source files outside Root Directory | **On** |
| Framework Preset | **Next.js** |
| Build Command | *(empty — override OFF)* |
| Output Directory | *(empty — override OFF)* |
| Install Command | *(empty — override OFF)* |

Uses `apps/web/vercel.json` automatically.

---

## Option B — Root Directory blank (repo root)

Same settings page:

| Setting | Value |
|---------|--------|
| Root Directory | *(blank)* |
| Framework Preset | **Next.js** |
| Build Command | *(empty — override OFF)* |
| **Output Directory** | **Must be empty — turn OFF the override toggle** |
| Install Command | *(empty — override OFF)* |

Uses root `vercel.json` automatically.

### Critical: turn OFF Output Directory override

If you see **Output Directory = `public`**, that is the bug. Click **Edit**, turn **Override** off, save, redeploy.

Error you may see if this is wrong:
```
No Output Directory named "public" found
```

---

## Environment variables

| Variable | Required |
|----------|----------|
| `DATABASE_URL` or `POSTGRES_URL` | Yes (Neon) |
| `AUTH_SECRET` | Yes |
| `NEXT_PUBLIC_APP_URL` | Yes |

## After first successful deploy

```bash
curl -X POST https://YOUR-APP.vercel.app/api/setup \
  -H "x-setup-secret: YOUR_AUTH_SECRET"
```

Login: `demo@scribble.app` / `scribble`
