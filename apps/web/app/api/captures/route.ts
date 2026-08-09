import { NextRequest } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { extractLifeObjects } from "@workspace/ai"
import { getDb, captures, energyNotes, people, tasks } from "@workspace/db"
import { ingestText } from "@workspace/mind"
import { badRequest, json, withAuth } from "@/lib/api"

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
    const inserted = await db
      .insert(captures)
      .values({
        userId: user.id,
        rawText: body.rawText,
        status: "pending",
        extracted,
      })
      .returning()
    const capture = inserted[0]
    if (!capture) return badRequest("Could not create capture")

    // Index raw capture into thin memory layer immediately
    await ingestText(db, {
      userId: user.id,
      text: body.rawText,
      sourceType: "capture",
      sourceId: capture.id,
    })

    return json({ capture, extracted }, { status: 201 })
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
        candidates?: Array<{
          type: string
          title?: string
          data?: Record<string, unknown>
        }>
      }
      const created: Record<string, unknown>[] = []

      for (const c of extracted?.candidates ?? []) {
        if (c.type === "task") {
          const [t] = await db
            .insert(tasks)
            .values({
              userId: user.id,
              title: c.title || "Untitled task",
              description: (c.data?.description as string) || null,
              priority: (c.data?.priority as "medium") || "medium",
              energyCost: (c.data?.energyCost as "medium") || null,
              estimatedDuration: (c.data?.estimatedDuration as number) || null,
              deadline: c.data?.deadline
                ? new Date(String(c.data.deadline))
                : null,
              sourceCaptureId: capture.id,
            })
            .returning()
          created.push({ type: "task", ...t })
        } else if (c.type === "energy") {
          const [e] = await db
            .insert(energyNotes)
            .values({
              userId: user.id,
              level: (c.data?.level as "medium") || "medium",
              notes: (c.data?.notes as string) || c.title || null,
            })
            .returning()
          created.push({ type: "energy", ...e })
        } else if (c.type === "person") {
          const [p] = await db
            .insert(people)
            .values({
              userId: user.id,
              name: (c.data?.name as string) || c.title || "Someone",
              relationship: (c.data?.relationship as string) || null,
              notes: (c.data?.notes as string) || null,
            })
            .returning()
          created.push({ type: "person", ...p })
        }
      }

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
