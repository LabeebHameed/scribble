# Scribble mobile (Expo) — voice-first client

One screen: glance + hold-to-speak. Standalone app (not in the root pnpm workspace) — use **npm** here.

## Setup

1. `extra.apiUrl` in [`app.json`](app.json) should be your Vercel URL (already set if you use the default deploy).
2. Ensure `GROQ_API_KEY` is set on that Vercel project.
3. Install and start:

```bash
cd apps/mobile
rm -rf node_modules
npm install
npx expo start
```

4. Scan with Expo Go, or press `i` / `a` for a simulator.

## Verified in CI / agent

These were run successfully in the cloud agent before merge:

```bash
cd apps/mobile
npm install
npx expo export --platform web --output-dir /tmp/scribble-expo-export
# Metro bundled expo-router entry (946 modules)

CI=1 npx expo start --port 8081
# → "Waiting on http://localhost:8081" (HTTP 200)
```

Do **not** use `workspace:*` deps here — npm cannot resolve them.
