import { NextRequest } from "next/server"
import { isGroqConfigured, synthesizeSpeech } from "@/lib/groq-voice"
import { badRequest, json } from "@/lib/api"

export async function POST(req: NextRequest) {
  if (!isGroqConfigured()) {
    return json({ error: "GROQ_API_KEY not configured" }, { status: 503 })
  }

  try {
    const body = await req.json()
    if (!body.text?.trim()) return badRequest("text required")
    const audio = await synthesizeSpeech(String(body.text))
    return json({
      audioBase64: audio.base64,
      audioMime: audio.mime,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "TTS failed"
    return json({ error: message }, { status: 500 })
  }
}
