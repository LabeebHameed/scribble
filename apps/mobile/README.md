# Scribble mobile (Expo) — voice-first client

One screen: glance (Now / Needs attention / Next up) + hold-to-speak.

This app is **standalone** (not part of the root pnpm workspace). Use **npm** inside `apps/mobile`.

## Voice loop

1. Hold the button → records audio (`expo-av`)
2. `POST {apiUrl}/api/converse` with the audio file
3. Server: Groq Whisper STT → intents/clarify → Groq PlayAI TTS
4. App plays the reply and updates the glance

`GROQ_API_KEY` stays on the **server** (Vercel), never in this app.

## Setup

1. Set `apiUrl` in [`app.json`](app.json) to your Vercel URL, e.g. `https://scribble-xxx.vercel.app`
2. Install and start:

```bash
cd apps/mobile
npm install
npx expo start
```

3. Scan the QR code with **Expo Go** (same Wi‑Fi if using a LAN URL), or press `i` / `a` for a simulator.

Do **not** run `npm install` from the repo root for this app, and do not use `workspace:*` packages here — that only works with pnpm monorepo installs.
