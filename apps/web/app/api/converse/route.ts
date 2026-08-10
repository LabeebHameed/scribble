import { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import {
  parseIntents,
  resolveClarification,
  type LifeIntent,
  type PendingClarification,
} from "@workspace/ai"
import { getDb, voiceSessions } from "@workspace/db"
import { hybridSearch } from "@workspace/mind"
import { badRequest, json, withAuth } from "@/lib/api"
import { buildBriefing } from "@/lib/briefing"
import { buildGlance } from "@/lib/glance"
import { executeIntents } from "@/lib/life-actions"
import { isGroqConfigured, synthesizeSpeech, transcribeAudio } from "@/lib/groq-voice"
import { chooseNextAction } from "@/lib/next-action"
import { buildPlate, latestEnergy } from "@/lib/plate"
import { rememberExchange } from "@/lib/remember"

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

async function maybeAutoPlan(userId: string, actions: { kind: string }[]) {
  const created = actions.some((a) =>
    ["task", "event", "reminder"].includes(a.kind)
  )
  if (!created) return null
  const db = getDb()
  const planResults = await executeIntents(db, userId, [{ type: "plan_day" }])
  return planResults[0] || null
}

async function assistantState(db: ReturnType<typeof getDb>, userId: string) {
  const glance = await buildGlance(db, userId)
  const plate = await buildPlate(db, userId, glance)
  const energy = await latestEnergy(db, userId)
  const nextAction = chooseNextAction({ glance, plate, energy })
  return {
    glance,
    plate,
    energy,
    nextAction,
    assistant: {
      nextAction,
      why: nextAction.reason,
      plateCount: plate.length,
      memoryHints: [] as string[],
    },
  }
}

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const state = await assistantState(db, user.id)
    return json({
      glance: state.glance,
      plate: state.plate.map((p) => ({
        id: p.id,
        title: p.title,
        kind: p.kind,
        status: p.status,
      })),
      assistant: state.assistant,
    })
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
            { error: "GROQ_API_KEY not configured on server — voice upload needs it" },
            { status: 503 }
          )
        }
        if (file.size === 0) {
          return badRequest("Empty audio upload — record a bit longer and try again")
        }
        const name =
          file instanceof File && file.name
            ? file.name
            : "speech.m4a"
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

    // Sense
    let glance = await buildGlance(db, user.id)
    let plate = await buildPlate(db, user.id, glance)
    let energy = await latestEnergy(db, user.id)

    // Recall
    let memoryHits: Array<{ content: string }> = []
    try {
      memoryHits = await hybridSearch(db, {
        userId: user.id,
        query: transcript,
        limit: 6,
      })
    } catch (e) {
      console.warn("hybridSearch failed", e)
    }
    const memoryHints = memoryHits.map((h) => h.content).filter(Boolean)

    const actions: { kind: string; summary: string; data?: unknown }[] = []
    let ask: string | null = null
    let needsReply = false

    const pending = await getPending(user.id, sessionKey)

    if (pending) {
      const resolved = resolveClarification(pending, transcript)
      if (resolved.stillMissing) {
        await setPending(user.id, sessionKey, resolved.stillMissing)
        ask = resolved.ask || resolved.stillMissing.ask
        needsReply = true
      } else if (resolved.intent) {
        await setPending(user.id, sessionKey, null)
        const results = await executeIntents(db, user.id, [resolved.intent])
        actions.push(...results)
        const auto = await maybeAutoPlan(user.id, results)
        if (auto) actions.push(auto)
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
        ask = incomplete.ask
        needsReply = true
      } else {
        const runnable = intents.filter((i) => i.type !== "incomplete")
        const results = await executeIntents(db, user.id, runnable)
        actions.push(...results)

        const whatsNext = results.find((r) => r.kind === "whats_next")
        if (!whatsNext) {
          const auto = await maybeAutoPlan(user.id, results)
          if (auto && auto.kind === "plan") actions.push(auto)
        }
      }
    }

    // Refresh day state after acts
    glance = await buildGlance(db, user.id)
    plate = await buildPlate(db, user.id, glance)
    energy = await latestEnergy(db, user.id)
    const nextAction = chooseNextAction({
      glance,
      plate,
      energy,
      memoryHints,
    })

    const reply = await buildBriefing({
      glance,
      plate,
      energy,
      memoryHits,
      actions: actions.filter((a) => a.summary !== "whats_next"),
      nextAction,
      ask,
      needsReply,
    })

    // Remember
    await rememberExchange(db, user.id, transcript, reply, sessionKey)

    const assistant = {
      nextAction,
      why: nextAction.reason,
      plateCount: plate.length,
      memoryHints: memoryHints.slice(0, 3).map((h) => h.slice(0, 160)),
    }

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
      assistant,
      plate: plate.map((p) => ({
        id: p.id,
        title: p.title,
        kind: p.kind,
        status: p.status,
      })),
    })
  })
}
