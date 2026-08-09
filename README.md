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

## Quick start

```bash
# Postgres 16 + pgvector already assumed locally
cp .env.example .env

pnpm install
pnpm db:migrate
pnpm db:seed
pnpm --filter web dev
```

Demo login: `demo@scribble.app` / `scribble`

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
