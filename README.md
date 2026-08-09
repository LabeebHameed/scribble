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

## Deploy on Vercel

The repo includes [`vercel.json`](vercel.json) with `rootDirectory: apps/web` so Vercel treats this as a **Next.js monorepo app**, not a static `public/` site.

1. Import the GitHub repo in Vercel (branch `main`).
2. **Do not** override Output Directory to `public` — leave framework detection to Next.js.
3. Add environment variables in Vercel → Settings → Environment Variables:
   - `DATABASE_URL` — [Neon](https://neon.tech) or Vercel Postgres (must support `pgvector`)
   - `AUTH_SECRET` — long random string
   - `NEXT_PUBLIC_APP_URL` — your production URL (e.g. `https://scribble.vercel.app`)
   - Optional: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
4. After first deploy, run migrations against production DB (from your machine):
   ```bash
   DATABASE_URL="postgresql://..." pnpm db:migrate
   DATABASE_URL="postgresql://..." pnpm db:seed
   ```
5. Check health: `GET /api/health` should return `{ ok: true, db: "connected" }`.

If build fails with “No Output Directory named public”, clear any custom **Output Directory** in Vercel project settings (leave blank for Next.js) and redeploy. Root [`vercel.json`](vercel.json) sets `rootDirectory: apps/web` so Vercel deploys the Next.js app, not a static `public/` folder at the repo root.

## Environment

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection |
| `OPENAI_BASE_URL` | OpenRouter / NVIDIA / OpenAI base |
| `OPENAI_API_KEY` | Hosted LLM key (optional — heuristic mode works offline) |
| `OPENAI_MODEL` | Chat model id |
| `EMBEDDING_MODE` | `hash` (default) or `api` |
| `AUTH_SECRET` | Session signing material |

## Product surfaces

Today · Capture/Chat · Tasks · Schedule · Memory · Settings

## MIND scope

Only on-demand capture/note ingest, hybrid retrieval, and light consolidation. **Not** ported: Python daemon, file watchers, app-focus monitor, Tauri graph, IDE MCP.
