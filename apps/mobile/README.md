# Scribble mobile (Expo)

Scaffold for the later Expo client. It shares domain contracts via `@workspace/core`.

## Why it's outside the default workspace install

The Next.js web app uses React 19. Expo SDK 52 pins React 18. To avoid monorepo peer conflicts, `apps/mobile` is **not** included in the root `pnpm-workspace.yaml` yet.

## When upgrading

1. Align React versions (or isolate with a separate lockfile).
2. Add `apps/mobile` back to `pnpm-workspace.yaml`.
3. Point `expo.extra.apiUrl` at the deployed Scribble API.
4. Wire screens to `/api/captures`, `/api/plan`, `/api/chat`, etc.
5. Add native push (replacing the web service-worker placeholder).

```bash
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript # if regenerating
npx expo start
```
