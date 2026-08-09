import { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import {
  parseIntents,
  resolveClarification,
  type LifeIntent,
  type PendingClarification,
} from "@workspace/ai"
import { getDb, voiceSessions } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"
import { buildGlance } from "@/lib/glance"
import { executeIntents } from "@/lib/life-actions"
import { isGroqConfigured, synthesizeSpeech, transcribeAudio } from "@/lib/groq-voice"

async function getPending(
  userId: string,
  sessionKey: string
): Promise<PendingClarification | null> {
  const db = getDb()
  const rows = await db
    .select()
    .from(voiceSessions)
    .where(
      and(eq(voiceSessions.userId, userId), eq(voiceSessions.sessionKey, sessionKey))
    )
    .limit(1)
  return (rows[0]?.pending as PendingClarification | null) ?? null
}

async function setPending(
  userId: string,
  sessionKey: string,
  pending: PendingClarification | null
) {
  const db = getDb()
  const existing = await db
    .select()
    .from(voiceSessions)
    .where(
      and(eq(voiceSessions.userId, userId), eq(voiceSessions.sessionKey, sessionKey))
    )
    .limit(1)

  if (existing[0]) {
    await db
      .update(voiceSessions)
      .set({ pending, updatedAt: new Date() })
      .where(eq(voiceSessions.id, existing[0].id))
  } else {
    await db.insert(voiceSessions).values({
      userId,
      sessionKey,
      pending,
    })
  }
}

function glanceSpoken(glance: Awaited<ReturnType<typeof buildGlance>>) {
  if (glance.needsAttention[0]) {
    return `Needs attention: ${glance.needsAttention[0].message}`
  }
  if (glance.now) return `Right now: ${glance.now.title}`
  if (glance.nextUp[0]) {
    const t = new Date(glance.nextUp[0].start).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
    return `Next up: ${glance.nextUp[0].title} at ${t}`
  }
  return "Nothing scheduled yet. Tell me a task, meeting, or reminder."
}

async function maybeAutoPlan(userId: string, actions: { kind: string }[]) {
  const created = actions.some((a) =>
    ["task", "event", "reminder"].includes(a.kind)
  )
  if (!created) return null
  const db = getDb()
  const planResults = await executeIntents(db, userId, [{ type: "plan_day" }])
  return planResults[0] || null
}

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const glance = await buildGlance(db, user.id)
    return json({ glance })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const contentType = req.headers.get("content-type") || ""
    let transcript = ""
    let sessionKey = "default"
    let wantAudio = true

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      sessionKey = String(form.get("sessionId") || form.get("sessionKey") || "default")
      wantAudio = String(form.get("speak") || "true") !== "false"
      const textField = form.get("transcript")
      if (typeof textField === "string" && textField.trim()) {
        transcript = textField.trim()
      } else {
        const file = form.get("audio") || form.get("file")
        if (!(file instanceof Blob)) {
          return badRequest("audio or transcript required")
        }
        if (!isGroqConfigured()) {
          return json(
            { error: "GROQ_API_KEY not configured — pass transcript for text mode" },
            { status: 503 }
          )
        }
        const name = file instanceof File && file.name ? file.name : "audio.wav"
        transcript = await transcribeAudio(file, name)
      }
    } else {
      const body = await req.json()
      transcript = String(body.transcript || body.message || "").trim()
      sessionKey = String(body.sessionId || body.sessionKey || "default")
      wantAudio = body.speak !== false
      if (!transcript) return badRequest("transcript required")
    }

    if (!transcript) return badRequest("empty transcript")

    const db = getDb()
    const actions: { kind: string; summary: string; data?: unknown }[] = []
    let reply = ""
    let needsReply = false

    const pending = await getPending(user.id, sessionKey)

    if (pending) {
      const resolved = resolveClarification(pending, transcript)
      if (resolved.stillMissing) {
        await setPending(user.id, sessionKey, resolved.stillMissing)
        reply = resolved.ask || resolved.stillMissing.ask
        needsReply = true
      } else if (resolved.intent) {
        await setPending(user.id, sessionKey, null)
        const results = await executeIntents(db, user.id, [resolved.intent])
        actions.push(...results)
        const auto = await maybeAutoPlan(user.id, results)
        if (auto) actions.push(auto)
        reply = results.map((r) => r.summary).join(". ")
      }
    } else {
      const intents = parseIntents(transcript)
      const incomplete = intents.find((i) => i.type === "incomplete") as
        | Extract<LifeIntent, { type: "incomplete" }>
        | undefined

      if (incomplete) {
        const slot: PendingClarification = {
          kind: incomplete.kind,
          title: incomplete.title,
          missing: incomplete.missing,
          partial: incomplete.partial,
          ask: incomplete.ask,
        }
        await setPending(user.id, sessionKey, slot)
        reply = incomplete.ask
        needsReply = true
      } else {
        const runnable = intents.filter((i) => i.type !== "incomplete")
        const results = await executeIntents(db, user.id, runnable)
        actions.push(...results)

        const whatsNext = results.find((r) => r.kind === "whats_next")
        if (whatsNext) {
          const glanceEarly = await buildGlance(db, user.id)
          reply = glanceSpoken(glanceEarly)
        } else {
          const auto = await maybeAutoPlan(user.id, results)
          if (auto && auto.kind === "plan") actions.push(auto)
          reply =
            results.map((r) => r.summary).filter((s) => s !== "whats_next").join(". ") ||
            "Okay."
          if (auto?.summary && !reply.includes("Proposed")) {
            reply = `${reply}. ${auto.summary}`
          }
        }
      }
    }

    const glance = await buildGlance(db, user.id)

    let audioBase64: string | null = null
    let audioMime: string | null = null
    if (wantAudio && isGroqConfigured() && reply) {
      try {
        const audio = await synthesizeSpeech(reply)
        audioBase64 = audio.base64
        audioMime = audio.mime
      } catch (e) {
        console.warn("TTS failed, returning text only", e)
      }
    }

    return json({
      transcript,
      reply,
      needsReply,
      sessionId: sessionKey,
      audioBase64,
      audioMime,
      glance,
      actions,
    })
  })
}
