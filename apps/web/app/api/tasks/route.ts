import { NextRequest } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { getDb, tasks } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET(req: NextRequest) {
  return withAuth(async (user) => {
    const filter = req.nextUrl.searchParams.get("filter") || "all"
    const db = getDb()
    let rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, user.id))
      .orderBy(desc(tasks.updatedAt))

    if (filter === "today") {
      rows = rows.filter((t) => t.status === "open" || t.status === "in_progress")
    } else if (filter === "open") {
      rows = rows.filter((t) => t.status === "open" || t.status === "in_progress")
    } else if (filter === "energy_low") {
      rows = rows.filter((t) => t.energyCost === "low")
    } else if (filter === "high") {
      rows = rows.filter((t) => t.priority === "high" || t.priority === "critical")
    }

    return json({ tasks: rows })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.title) return badRequest("title required")
    const db = getDb()
    const [row] = await db
      .insert(tasks)
      .values({
        userId: user.id,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? "open",
        priority: body.priority ?? "medium",
        energyCost: body.energyCost ?? null,
        estimatedDuration: body.estimatedDuration ?? null,
        deadline: body.deadline ? new Date(body.deadline) : null,
        preferredWindows: body.preferredWindows ?? [],
        project: body.project ?? null,
        area: body.area ?? null,
        parentTaskId: body.parentTaskId ?? null,
        sourceCaptureId: body.sourceCaptureId ?? null,
      })
      .returning()
    return json({ task: row }, { status: 201 })
  })
}

export async function PATCH(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.id) return badRequest("id required")
    const db = getDb()
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    for (const key of [
      "title",
      "description",
      "status",
      "priority",
      "energyCost",
      "estimatedDuration",
      "project",
      "area",
      "parentTaskId",
    ] as const) {
      if (body[key] !== undefined) patch[key] = body[key]
    }
    if (body.deadline !== undefined) {
      patch.deadline = body.deadline ? new Date(body.deadline) : null
    }
    if (body.status === "done") patch.completedAt = new Date()
    const [row] = await db
      .update(tasks)
      .set(patch)
      .where(and(eq(tasks.id, body.id), eq(tasks.userId, user.id)))
      .returning()
    return json({ task: row })
  })
}

export async function DELETE(req: NextRequest) {
  return withAuth(async (user) => {
    const id = req.nextUrl.searchParams.get("id")
    if (!id) return badRequest("id required")
    const db = getDb()
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    return json({ ok: true })
  })
}
