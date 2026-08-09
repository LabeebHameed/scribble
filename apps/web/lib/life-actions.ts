import { and, desc, eq } from "drizzle-orm"
import type { LifeIntent } from "@workspace/ai"
import { proposeDayPlan } from "@workspace/core"
import type { Db } from "@workspace/db"
import {
  energyNotes,
  events,
  scheduledBlocks,
  tasks,
} from "@workspace/db"
import { hybridSearch } from "@workspace/mind"
import { createReminderForTask } from "@/lib/materialize"

export type ActionResult = {
  kind: string
  summary: string
  data?: unknown
}

export async function executeIntents(
  db: Db,
  userId: string,
  intents: LifeIntent[]
): Promise<ActionResult[]> {
  const results: ActionResult[] = []

  for (const intent of intents) {
    if (intent.type === "task") {
      const [t] = await db
        .insert(tasks)
        .values({
          userId,
          title: intent.title,
          priority: intent.priority || "medium",
          estimatedDuration: intent.estimatedDuration || 30,
          deadline: intent.deadline || null,
          status: "open",
        })
        .returning()
      results.push({
        kind: "task",
        summary: `Task: ${intent.title}`,
        data: t,
      })
    } else if (intent.type === "event") {
      const [ev] = await db
        .insert(events)
        .values({
          userId,
          title: intent.title,
          start: intent.start,
          end: intent.end,
          isFixed: true,
        })
        .returning()
      if (ev) {
        await db.insert(scheduledBlocks).values({
          userId,
          kind: "event",
          title: ev.title,
          start: ev.start,
          end: ev.end,
          eventId: ev.id,
          isProposal: false,
          accepted: true,
        })
      }
      results.push({
        kind: "event",
        summary: `Event: ${intent.title} at ${intent.start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        data: ev,
      })
    } else if (intent.type === "reminder") {
      const [t] = await db
        .insert(tasks)
        .values({
          userId,
          title: intent.title,
          priority: "medium",
          estimatedDuration: 15,
          status: "open",
        })
        .returning()
      if (t) {
        await createReminderForTask(
          db,
          userId,
          t.id,
          intent.title,
          intent.actionLanguage,
          intent.fireAt
        )
      }
      const when = intent.fireAt.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
      results.push({
        kind: "reminder",
        summary: `Reminder set for ${when}: ${intent.actionLanguage}`,
        data: t,
      })
    } else if (intent.type === "energy") {
      const [e] = await db
        .insert(energyNotes)
        .values({
          userId,
          level: intent.level,
          notes: intent.notes || null,
        })
        .returning()
      results.push({
        kind: "energy",
        summary: `Logged ${intent.level} energy`,
        data: e,
      })
    } else if (intent.type === "plan_day") {
      const taskRows = await db.select().from(tasks).where(eq(tasks.userId, userId))
      const eventRows = await db.select().from(events).where(eq(events.userId, userId))
      const energy = await db
        .select()
        .from(energyNotes)
        .where(eq(energyNotes.userId, userId))
        .orderBy(desc(energyNotes.timestamp))
        .limit(1)
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date()
      dayEnd.setHours(23, 59, 59, 999)
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
        routineWindows: [],
        energy: energy[0]?.level ?? null,
      })

      const existing = await db
        .select()
        .from(scheduledBlocks)
        .where(and(eq(scheduledBlocks.userId, userId), eq(scheduledBlocks.isProposal, true)))
      for (const b of existing) {
        if (b.accepted == null) {
          await db.delete(scheduledBlocks).where(eq(scheduledBlocks.id, b.id))
        }
      }

      let count = 0
      for (const slot of proposal.slots) {
        await db.insert(scheduledBlocks).values({
          userId,
          kind: "task",
          title: slot.title,
          start: slot.start,
          end: slot.end,
          taskId: slot.taskId,
          isProposal: true,
          accepted: null,
        })
        count++
      }
      results.push({
        kind: "plan",
        summary:
          count > 0
            ? `Proposed ${count} block${count === 1 ? "" : "s"} for today — check Today`
            : "No blocks to propose yet — capture tasks with durations first",
        data: proposal,
      })
    } else if (intent.type === "list_tasks") {
      const open = await db.select().from(tasks).where(eq(tasks.userId, userId))
      const active = open.filter(
        (t) => t.status === "open" || t.status === "in_progress"
      )
      results.push({
        kind: "list",
        summary:
          active.length > 0
            ? active.map((t) => t.title).join("; ")
            : "Nothing open yet — capture something",
        data: active,
      })
    } else if (intent.type === "whats_next") {
      results.push({
        kind: "whats_next",
        summary: "whats_next",
        data: null,
      })
    } else if (intent.type === "memory_query") {
      const hits = await hybridSearch(db, {
        userId,
        query: intent.query,
        limit: 3,
      })
      results.push({
        kind: "memory",
        summary:
          hits[0]?.content?.slice(0, 200) ||
          "Nothing relevant in memory yet.",
        data: hits,
      })
    }
  }

  return results
}
