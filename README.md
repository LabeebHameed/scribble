# Scribble

ADHD life operating system — capture anything, keep a coherent life model, plan realistically, remind in ways that stick, and converse with an assistant that already knows your life.

**Stack:** Next.js (MVP client) → Expo later · TypeScript · Postgres + pgvector · OpenAI-compatible LLM (OpenRouter / NVIDIA) · thin MIND-inspired memory (no daemon / watchers).

## Monorepo

```
apps/web       Next.js App Router UI + API
apps/mobile    Expo scaffold (shares @workspace/core)
packages/core  Life object schemas + hybrid planner
packages/db    Drizzle schema / migrate / seed
packages/mind  On-demand ingest + hybrid FTS/vector search
packages/ai    LLM client, extraction, tool defs
packages/ui    shadcn components
```

## Quick start (local)

```bash
# Postgres 16 + pgvector already assumed locally
cp .env.example .env

pnpm install
pnpm db:migrate
pnpm db:seed
pnpm --filter web dev
```

Demo login: `demo@scribble.app` / `scribble`

## Deploy on Vercel + Neon

1. Connect [Neon](https://neon.tech) to your Vercel project (Storage → Neon). Vercel will inject `DATABASE_URL` and/or `POSTGRES_URL`.
2. In **[Project Settings → Build & Deployment](https://vercel.com/labeebs-projects-649a4343/scribble/settings)**:
   - **Root Directory:** `apps/web` (enable “Include source files outside of the Root Directory”)
   - **Framework Preset:** Next.js
   - **Output Directory:** leave **blank** (turn off any override — must not be `public`)
   - **Build Command:** leave blank (uses `vercel-build` / `vercel.json`)
3. Add environment variables:
   - `AUTH_SECRET` — long random string (also used for one-time setup)
   - `NEXT_PUBLIC_APP_URL` — your Vercel URL
   - Optional: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
4. After the first successful deploy, initialize the database (no local CLI needed):
   ```bash
   curl -X POST https://YOUR-APP.vercel.app/api/setup \
     -H "x-setup-secret: YOUR_AUTH_SECRET"
   ```
   This runs migrations + creates the demo user (`demo@scribble.app` / `scribble`).
5. Check `GET /api/health` → `{ "ok": true, "db": "connected" }`.

If deploy fails with “No Output Directory named public”, clear the **Output Directory** override in Vercel settings and redeploy. Connecting Neon does not fix that — it is a project framework setting issue.

Root `app/` and `public/` symlinks support repo-root deploys as a fallback when Root Directory is left blank.

## Environment

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` / `POSTGRES_URL` | Postgres connection (auto-set by Neon on Vercel) |
| `OPENAI_BASE_URL` | OpenRouter / NVIDIA / OpenAI base |
| `OPENAI_API_KEY` | Hosted LLM key (optional — heuristic mode works offline) |
| `OPENAI_MODEL` | Chat model id |
| `EMBEDDING_MODE` | `hash` (default) or `api` |
| `AUTH_SECRET` | Session signing material |

## Product surfaces

Today · Capture/Chat · Tasks · Schedule · Memory · Settings

## MIND scope

Only on-demand capture/note ingest, hybrid retrieval, and light consolidation. **Not** ported: Python daemon, file watchers, app-focus monitor, Tauri graph, IDE MCP.
