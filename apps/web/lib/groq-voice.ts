const GROQ_BASE = "https://api.groq.com/openai/v1"

function groqKey() {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error("GROQ_API_KEY is not configured")
  return key
}

/** Groq Whisper STT — audio file → transcript text */
export async function transcribeAudio(
  file: Blob | File | Buffer,
  filename = "audio.wav"
): Promise<string> {
  const form = new FormData()
  const blob =
    file instanceof Blob
      ? file
      : new Blob([new Uint8Array(file)], { type: "audio/wav" })
  form.append("file", blob, filename)
  form.append("model", "whisper-large-v3-turbo")
  form.append("language", "en")
  form.append("response_format", "json")
  form.append("temperature", "0")

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey()}` },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq STT failed ${res.status}: ${err}`)
  }

  const json = (await res.json()) as { text?: string }
  return (json.text || "").trim()
}

/** Groq PlayAI TTS — reply text → audio bytes (wav) */
export async function synthesizeSpeech(text: string): Promise<{
  buffer: Buffer
  mime: string
  base64: string
}> {
  const res = await fetch(`${GROQ_BASE}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey()}`,
      "Content-Type": "application/json",
      Accept: "audio/wav",
    },
    body: JSON.stringify({
      model: "playai-tts",
      voice: "Fritz-PlayAI",
      input: text.slice(0, 2000),
      response_format: "wav",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq TTS failed ${res.status}: ${err}`)
  }

  const ab = await res.arrayBuffer()
  const buffer = Buffer.from(ab)
  return {
    buffer,
    mime: "audio/wav",
    base64: buffer.toString("base64"),
  }
}

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY)
}
