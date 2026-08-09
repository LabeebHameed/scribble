import { NextRequest } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { extractLifeObjects } from "@workspace/ai"
import type { Db } from "@workspace/db"
import { getDb, captures, energyNotes, people, tasks } from "@workspace/db"
import { ingestText } from "@workspace/mind"
import { badRequest, json, withAuth } from "@/lib/api"

type Candidate = {
  type: string
  title?: string
  data?: Record<string, unknown>
}

async function materializeCandidates(
  db: Db,
  userId: string,
  captureId: string,
  candidates: Candidate[]
) {
  const created: Record<string, unknown>[] = []

  for (const c of candidates) {
    if (c.type === "task") {
      const [t] = await db
        .insert(tasks)
        .values({
          userId,
          title: c.title || "Untitled task",
          description: (c.data?.description as string) || null,
          priority: (c.data?.priority as "medium") || "medium",
          energyCost: (c.data?.energyCost as "medium") || null,
          estimatedDuration: (c.data?.estimatedDuration as number) || null,
          deadline: c.data?.deadline ? new Date(String(c.data.deadline)) : null,
          sourceCaptureId: captureId,
        })
        .returning()
      created.push({ type: "task", ...t })
    } else if (c.type === "energy") {
      const [e] = await db
        .insert(energyNotes)
        .values({
          userId,
          level: (c.data?.level as "medium") || "medium",
          notes: (c.data?.notes as string) || c.title || null,
        })
        .returning()
      created.push({ type: "energy", ...e })
    } else if (c.type === "person") {
      const [p] = await db
        .insert(people)
        .values({
          userId,
          name: (c.data?.name as string) || c.title || "Someone",
          relationship: (c.data?.relationship as string) || null,
          notes: (c.data?.notes as string) || null,
        })
        .returning()
      created.push({ type: "person", ...p })
    }
  }

  return created
}

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const rows = await db
      .select()
      .from(captures)
      .where(eq(captures.userId, user.id))
      .orderBy(desc(captures.createdAt))
      .limit(50)
    return json({ captures: rows })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.rawText?.trim()) return badRequest("rawText required")
    const db = getDb()
    const extracted = await extractLifeObjects(body.rawText)
    const autoConfirm = body.autoConfirm === true

    const inserted = await db
      .insert(captures)
      .values({
        userId: user.id,
        rawText: body.rawText,
        status: autoConfirm ? "confirmed" : "pending",
        extracted,
      })
      .returning()
    const capture = inserted[0]
    if (!capture) return badRequest("Could not create capture")

    await ingestText(db, {
      userId: user.id,
      text: body.rawText,
      sourceType: "capture",
      sourceId: capture.id,
    })

    let created: Record<string, unknown>[] = []
    if (autoConfirm) {
      created = await materializeCandidates(
        db,
        user.id,
        capture.id,
        extracted.candidates ?? []
      )
    }

    return json({ capture, extracted, created }, { status: 201 })
  })
}

export async function PATCH(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.id) return badRequest("id required")
    const db = getDb()
    const rows = await db
      .select()
      .from(captures)
      .where(and(eq(captures.id, body.id), eq(captures.userId, user.id)))
      .limit(1)
    const capture = rows[0]
    if (!capture) return badRequest("capture not found")

    if (body.status === "dismissed") {
      const [updated] = await db
        .update(captures)
        .set({ status: "dismissed", updatedAt: new Date() })
        .where(eq(captures.id, capture.id))
        .returning()
      return json({ capture: updated })
    }

    if (body.status === "confirmed") {
      const extracted = (body.extracted ?? capture.extracted) as {
        candidates?: Candidate[]
      }
      const created = await materializeCandidates(
        db,
        user.id,
        capture.id,
        extracted?.candidates ?? []
      )

      const [updated] = await db
        .update(captures)
        .set({
          status: "confirmed",
          extracted: extracted as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(captures.id, capture.id))
        .returning()

      return json({ capture: updated, created })
    }

    return badRequest("unsupported status")
  })
}
