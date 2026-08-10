import { eq } from "drizzle-orm"
import type { Db } from "@workspace/db"
import { events, tasks } from "@workspace/db"
import type { GlancePayload } from "@/lib/glance"
import type { PlateItem } from "@/lib/next-action"

export async function buildPlate(db: Db, userId: string, glance: GlancePayload): Promise<PlateItem[]> {
  const taskRows = await db.select().from(tasks).where(eq(tasks.userId, userId))
  const eventRows = await db.select().from(events).where(eq(events.userId, userId))

  const openTasks: PlateItem[] = taskRows
    .filter((t) => t.status === "open" || t.status === "in_progress")
    .map((t) => ({
      id: t.id,
      title: t.title,
      kind: "task" as const,
      status: t.status,
      priority: t.priority,
      energyCost: t.energyCost,
      estimatedDuration: t.estimatedDuration,
      deadline: t.deadline?.toISOString() ?? null,
    }))

  const reminderItems: PlateItem[] = glance.needsAttention.map((r) => ({
    id: r.id,
    title: r.message,
    kind: "reminder" as const,
    status: "needs_attention",
  }))

  const now = new Date()
  const upcomingEvents: PlateItem[] = eventRows
    .filter((e) => e.end >= now)
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      title: e.title,
      kind: "event" as const,
      status: "scheduled",
      deadline: e.start.toISOString(),
    }))

  // Dedupe by title+kind roughly; prefer tasks list as source of truth
  const seen = new Set(openTasks.map((t) => `task:${t.id}`))
  const merged = [...openTasks]
  for (const r of reminderItems) {
    const key = `reminder:${r.id}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(r)
    }
  }
  for (const e of upcomingEvents) {
    const key = `event:${e.id}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(e)
    }
  }
  return merged
}

export async function latestEnergy(
  db: Db,
  userId: string
): Promise<"low" | "medium" | "high" | null> {
  const { energyNotes } = await import("@workspace/db")
  const { desc } = await import("drizzle-orm")
  const rows = await db
    .select()
    .from(energyNotes)
    .where(eq(energyNotes.userId, userId))
    .orderBy(desc(energyNotes.timestamp))
    .limit(1)
  return (rows[0]?.level as "low" | "medium" | "high" | undefined) ?? null
}
