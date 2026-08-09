import { NextRequest } from "next/server"
import { and, desc, eq, gte, lte } from "drizzle-orm"
import { proposeDayPlan } from "@workspace/core"
import {
  energyNotes,
  events,
  getDb,
  preferences,
  routines,
  scheduledBlocks,
  tasks,
} from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET(req: NextRequest) {
  return withAuth(async (user) => {
    const day = req.nextUrl.searchParams.get("day") || new Date().toISOString()
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)
    const db = getDb()
    const blocks = await db
      .select()
      .from(scheduledBlocks)
      .where(
        and(
          eq(scheduledBlocks.userId, user.id),
          gte(scheduledBlocks.start, dayStart),
          lte(scheduledBlocks.start, dayEnd)
        )
      )
    return json({ blocks })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    const action = body.action || "propose"
    const db = getDb()

    if (action === "accept") {
      if (!body.blockId) return badRequest("blockId required")
      const [row] = await db
        .update(scheduledBlocks)
        .set({ accepted: true, isProposal: false, updatedAt: new Date() })
        .where(
          and(
            eq(scheduledBlocks.id, body.blockId),
            eq(scheduledBlocks.userId, user.id)
          )
        )
        .returning()
      return json({ block: row })
    }

    if (action === "reject") {
      if (!body.blockId) return badRequest("blockId required")
      await db
        .delete(scheduledBlocks)
        .where(
          and(
            eq(scheduledBlocks.id, body.blockId),
            eq(scheduledBlocks.userId, user.id)
          )
        )
      return json({ ok: true })
    }

    if (action === "ritual") {
      return json({
        prompt: "What are the 1–3 things that matter today?",
        suggestions: body.focus ?? [],
      })
    }

    // propose
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date()
    dayEnd.setHours(23, 59, 59, 999)

    const taskRows = await db.select().from(tasks).where(eq(tasks.userId, user.id))
    const eventRows = await db.select().from(events).where(eq(events.userId, user.id))
    const routineRows = await db
      .select()
      .from(routines)
      .where(eq(routines.userId, user.id))
    const energy = await db
      .select()
      .from(energyNotes)
      .where(eq(energyNotes.userId, user.id))
      .orderBy(desc(energyNotes.timestamp))
      .limit(1)
    const prefs = await db
      .select()
      .from(preferences)
      .where(eq(preferences.userId, user.id))
    const working = prefs.find((p) => p.type === "working_hours")
    const workingHours = (working?.value as { startHour?: number; endHour?: number }) || {
      startHour: 9,
      endHour: 18,
    }

    // Soft energy override from request
    const energyLevel =
      body.energy ||
      energy[0]?.level ||
      null

    const proposal = proposeDayPlan({
      dayStart,
      dayEnd,
      tasks: taskRows.map((t) => ({
        id: t.id,
        userId: t.userId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        energyCost: t.energyCost,
        estimatedDuration: t.estimatedDuration,
        deadline: t.deadline?.toISOString() ?? null,
        preferredWindows: (t.preferredWindows as []) ?? [],
        project: t.project,
        area: t.area,
        parentTaskId: t.parentTaskId,
        sourceCaptureId: t.sourceCaptureId,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        completedAt: t.completedAt?.toISOString() ?? null,
      })),
      fixedBlocks: eventRows.map((e) => ({
        start: e.start,
        end: e.end,
        title: e.title,
      })),
      routineWindows: routineRows.map((r) => {
        const start = new Date(dayStart)
        start.setHours(10, 0, 0, 0)
        const end = new Date(start.getTime() + (r.idealDuration || 30) * 60000)
        return {
          id: r.id,
          title: r.title,
          start,
          end,
          idealDuration: r.idealDuration,
          priority: r.priority,
          flexibility: r.flexibility,
        }
      }),
      energy: energyLevel,
      workingHours: {
        startHour: workingHours.startHour ?? 9,
        endHour: workingHours.endHour ?? 18,
      },
    })

    // Clear previous unaccepted proposals for the day
    const existing = await db
      .select()
      .from(scheduledBlocks)
      .where(
        and(
          eq(scheduledBlocks.userId, user.id),
          eq(scheduledBlocks.isProposal, true)
        )
      )
    for (const b of existing) {
      if (b.accepted == null) {
        await db.delete(scheduledBlocks).where(eq(scheduledBlocks.id, b.id))
      }
    }

    const created = []
    for (const slot of proposal.slots) {
      const [row] = await db
        .insert(scheduledBlocks)
        .values({
          userId: user.id,
          kind: "task",
          title: slot.title,
          start: slot.start,
          end: slot.end,
          taskId: slot.taskId,
          isProposal: true,
          accepted: null,
        })
        .returning()
      created.push({ ...row, reason: slot.reason })
    }

    // Place soft routines into free windows as proposals if no conflict
    for (const r of routineRows) {
      const start = new Date(dayStart)
      start.setHours(10, 0, 0, 0)
      const end = new Date(start.getTime() + (r.idealDuration || 20) * 60000)
      const [row] = await db
        .insert(scheduledBlocks)
        .values({
          userId: user.id,
          kind: "routine",
          title: r.title,
          start,
          end,
          routineId: r.id,
          isProposal: true,
          accepted: null,
        })
        .returning()
      created.push(row)
    }

    return json({
      proposal: {
        ...proposal,
        blocks: created,
      },
    })
  })
}

export async function PATCH(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.id) return badRequest("id required")
    const db = getDb()
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (body.start) patch.start = new Date(body.start)
    if (body.end) patch.end = new Date(body.end)
    if (body.title) patch.title = body.title
    const [row] = await db
      .update(scheduledBlocks)
      .set(patch)
      .where(
        and(eq(scheduledBlocks.id, body.id), eq(scheduledBlocks.userId, user.id))
      )
      .returning()
    return json({ block: row })
  })
}
