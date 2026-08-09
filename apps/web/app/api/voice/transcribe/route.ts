import { NextRequest, NextResponse } from "next/server"
import { isGroqConfigured, transcribeAudio } from "@/lib/groq-voice"
import { json } from "@/lib/api"

export async function POST(req: NextRequest) {
  if (!isGroqConfigured()) {
    return json({ error: "GROQ_API_KEY not configured" }, { status: 503 })
  }

  try {
    const contentType = req.headers.get("content-type") || ""
    let blob: Blob
    let filename = "audio.wav"

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("audio") || form.get("file")
      if (!(file instanceof Blob)) {
        return json({ error: "audio file required" }, { status: 400 })
      }
      blob = file
      if (file instanceof File && file.name) filename = file.name
    } else {
      const ab = await req.arrayBuffer()
      if (!ab.byteLength) return json({ error: "audio body required" }, { status: 400 })
      blob = new Blob([ab], { type: "audio/wav" })
    }

    const transcript = await transcribeAudio(blob, filename)
    return json({ transcript })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed"
    return json({ error: message }, { status: 500 })
  }
}
