import { and, asc, eq, gte, lte } from "drizzle-orm"
import type { Db } from "@workspace/db"
import {
  reminderChains,
  reminderInstances,
  scheduledBlocks,
} from "@workspace/db"
import { activateDueReminders } from "@/lib/materialize"

export type GlancePayload = {
  now: { title: string; start: string; end: string } | null
  needsAttention: Array<{
    id: string
    message: string
    title: string
    stage: string
  }>
  nextUp: Array<{ title: string; start: string; end: string; kind: string }>
}

export async function buildGlance(db: Db, userId: string): Promise<GlancePayload> {
  await activateDueReminders(db, userId)

  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(now)
  dayEnd.setHours(23, 59, 59, 999)

  const blocks = await db
    .select()
    .from(scheduledBlocks)
    .where(
      and(
        eq(scheduledBlocks.userId, userId),
        gte(scheduledBlocks.start, dayStart),
        lte(scheduledBlocks.start, dayEnd)
      )
    )
    .orderBy(asc(scheduledBlocks.start))

  const visible = blocks.filter((b) => b.accepted !== false)
  const current = visible.find((b) => b.start <= now && now <= b.end) || null
  const upcoming = visible
    .filter((b) => b.start > now)
    .slice(0, 3)
    .map((b) => ({
      title: b.title,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      kind: b.kind,
    }))

  const instances = await db
    .select({
      id: reminderInstances.id,
      message: reminderInstances.message,
      stage: reminderInstances.stage,
      status: reminderInstances.status,
      fireAt: reminderInstances.fireAt,
      title: reminderChains.title,
      persistentNag: reminderChains.persistentNag,
    })
    .from(reminderInstances)
    .innerJoin(reminderChains, eq(reminderChains.id, reminderInstances.chainId))
    .where(eq(reminderInstances.userId, userId))

  const needsAttention = instances
    .filter(
      (i) =>
        i.status === "sent" ||
        i.status === "snoozed" ||
        (i.status === "scheduled" && i.fireAt <= now) ||
        i.persistentNag
    )
    .slice(0, 5)
    .map((i) => ({
      id: i.id,
      message: i.message,
      title: i.title,
      stage: i.stage,
    }))

  return {
    now: current
      ? {
          title: current.title,
          start: current.start.toISOString(),
          end: current.end.toISOString(),
        }
      : null,
    needsAttention,
    nextUp: upcoming,
  }
}
