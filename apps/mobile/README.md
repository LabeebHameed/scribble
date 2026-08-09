# Scribble mobile (Expo) — voice-first client

One screen: glance (Now / Needs attention / Next up) + hold-to-speak.

## Voice loop

1. Hold the button → records audio on device (`expo-av`)
2. `POST {apiUrl}/api/converse` with the audio file
3. Server: Groq Whisper STT → intents/clarify → Groq PlayAI TTS
4. App plays the returned audio and updates the glance

`GROQ_API_KEY` stays on the **server** (Vercel / web `.env`), never in the app.

## Setup

Mobile is outside the root pnpm workspace (React 18 vs web React 19).

```bash
# Terminal 1 — API
cd /workspace
pnpm --filter web dev

# Terminal 2 — Expo
cd apps/mobile
npm install   # or pnpm install if using a local lockfile
npx expo start
```

Set `expo.extra.apiUrl` in [`app.json`](app.json) to your machine/LAN URL or Vercel deploy, e.g. `http://192.168.1.10:3000`.

## Permissions

iOS/Android mic permission is requested on first hold. Add usage strings in `app.json` plugins when building a store binary.
