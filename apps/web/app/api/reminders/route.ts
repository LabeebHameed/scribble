import { NextRequest } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import {
  getDb,
  reminderChains,
  reminderInstances,
  tasks,
} from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const instances = await db
      .select({
        id: reminderInstances.id,
        chainId: reminderInstances.chainId,
        stage: reminderInstances.stage,
        status: reminderInstances.status,
        fireAt: reminderInstances.fireAt,
        snoozedUntil: reminderInstances.snoozedUntil,
        message: reminderInstances.message,
        title: reminderChains.title,
        actionLanguage: reminderChains.actionLanguage,
        persistentNag: reminderChains.persistentNag,
        taskId: reminderChains.taskId,
      })
      .from(reminderInstances)
      .innerJoin(
        reminderChains,
        eq(reminderChains.id, reminderInstances.chainId)
      )
      .where(eq(reminderInstances.userId, user.id))
      .orderBy(desc(reminderInstances.fireAt))

    const needsAttention = instances.filter(
      (i) =>
        i.status === "sent" ||
        i.status === "snoozed" ||
        (i.status === "scheduled" && i.fireAt <= new Date()) ||
        i.persistentNag
    )

    return json({ instances, needsAttention })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.taskId || !body.actionLanguage) {
      return badRequest("taskId and actionLanguage required")
    }
    const db = getDb()
    const taskRows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, body.taskId), eq(tasks.userId, user.id)))
      .limit(1)
    const task = taskRows[0]
    if (!task) return badRequest("task not found")

    const inserted = await db
      .insert(reminderChains)
      .values({
        userId: user.id,
        title: task.title,
        actionLanguage: body.actionLanguage,
        taskId: task.id,
        persistentNag: Boolean(body.persistentNag),
      })
      .returning()
    const chain = inserted[0]
    if (!chain) return badRequest("Could not create chain")

    const now = Date.now()
    type Stage = "day_before" | "prep" | "action" | "final" | "nag"
    const stages: Array<{ stage: Stage; fireAt: Date; message: string }> = [
      {
        stage: "day_before",
        fireAt: new Date(now + 1 * 60 * 60 * 1000),
        message: `Tomorrow focus: ${task.title}`,
      },
      {
        stage: "prep",
        fireAt: new Date(now + 2 * 60 * 60 * 1000),
        message: `Prep for: ${body.actionLanguage}`,
      },
      {
        stage: "action",
        fireAt: new Date(now + 3 * 60 * 60 * 1000),
        message: body.actionLanguage,
      },
      {
        stage: "final",
        fireAt: new Date(now + 5 * 60 * 60 * 1000),
        message: `Still open — ${body.actionLanguage}`,
      },
    ]

    if (body.persistentNag) {
      stages.push({
        stage: "nag",
        fireAt: new Date(now + 6 * 60 * 60 * 1000),
        message: body.actionLanguage,
      })
    }

    const instances = []
    for (const s of stages) {
      const rows = await db
        .insert(reminderInstances)
        .values({
          chainId: chain.id,
          userId: user.id,
          stage: s.stage,
          status: s.stage === "action" ? "sent" : "scheduled",
          fireAt: s.fireAt,
          message: s.message,
        })
        .returning()
      if (rows[0]) instances.push(rows[0])
    }

    return json({ chain, instances }, { status: 201 })
  })
}

export async function PATCH(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.id || !body.action) return badRequest("id and action required")
    const db = getDb()

    if (body.action === "complete") {
      const [row] = await db
        .update(reminderInstances)
        .set({ status: "completed", updatedAt: new Date() })
        .where(
          and(
            eq(reminderInstances.id, body.id),
            eq(reminderInstances.userId, user.id)
          )
        )
        .returning()
      return json({ instance: row })
    }

    if (body.action === "acknowledge") {
      const [row] = await db
        .update(reminderInstances)
        .set({ status: "acknowledged", updatedAt: new Date() })
        .where(
          and(
            eq(reminderInstances.id, body.id),
            eq(reminderInstances.userId, user.id)
          )
        )
        .returning()
      return json({ instance: row })
    }

    if (body.action === "snooze") {
      const minutes = Number(body.minutes) || 15
      const [row] = await db
        .update(reminderInstances)
        .set({
          status: "snoozed",
          snoozedUntil: new Date(Date.now() + minutes * 60 * 1000),
          fireAt: new Date(Date.now() + minutes * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reminderInstances.id, body.id),
            eq(reminderInstances.userId, user.id)
          )
        )
        .returning()
      return json({ instance: row })
    }

    return badRequest("unknown action")
  })
}
