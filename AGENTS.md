# Scribble agent notes

- Life objects are first-class in Postgres (`packages/db`).
- Thin MIND layer lives in `packages/mind` — on-demand ingest + hybrid search only.
- Do not add file watchers, app-focus monitors, or the Python MIND daemon.
- LLM calls go through `packages/ai` with OpenAI-compatible base URL.
- UI: shadcn in `packages/ui`; design guidance in `.cursor/skills/ui-ux-pro-max`.
