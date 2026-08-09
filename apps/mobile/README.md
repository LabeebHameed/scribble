# Scribble mobile (Expo) — voice-first client

One screen: glance + hold-to-speak. Standalone app (not in the root pnpm workspace) — use **npm** here.

## Setup

1. Set `extra.apiUrl` in [`app.json`](app.json) to your Vercel URL.
2. Ensure `GROQ_API_KEY` is set on that Vercel project.
3. Install and start:

```bash
cd apps/mobile
rm -rf node_modules package-lock.json
npm install
npx expo start
```

4. Scan with Expo Go, or press `i` / `a` for a simulator.

## Verify (CI / agent)

```bash
cd apps/mobile
npm install
npx expo export --platform web --output-dir /tmp/scribble-expo-export
```

That confirms Metro can resolve the project (including `expo-asset` and router deps).
