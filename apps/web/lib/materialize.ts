import { eq } from "drizzle-orm"
import type { Db } from "@workspace/db"
import { reminderChains, reminderInstances } from "@workspace/db"

export async function createReminderForTask(
  db: Db,
  userId: string,
  taskId: string,
  title: string,
  actionLanguage: string,
  fireAt: Date
) {
  const [chain] = await db
    .insert(reminderChains)
    .values({
      userId,
      title,
      actionLanguage,
      taskId,
      persistentNag: false,
    })
    .returning()
  if (!chain) return null

  const now = Date.now()
  const fireMs = fireAt.getTime()
  const prepAt = new Date(Math.max(now, fireMs - 5 * 60 * 1000))

  await db.insert(reminderInstances).values([
    {
      chainId: chain.id,
      userId,
      stage: "prep",
      status: prepAt <= new Date() ? "sent" : "scheduled",
      fireAt: prepAt,
      message: `Coming up: ${actionLanguage}`,
    },
    {
      chainId: chain.id,
      userId,
      stage: "action",
      status: fireMs <= now ? "sent" : "scheduled",
      fireAt,
      message: actionLanguage,
    },
    {
      chainId: chain.id,
      userId,
      stage: "final",
      status: "scheduled",
      fireAt: new Date(fireMs + 30 * 60 * 1000),
      message: `Still open — ${actionLanguage}`,
    },
  ])

  return chain
}

export async function activateDueReminders(db: Db, userId: string) {
  const due = await db
    .select()
    .from(reminderInstances)
    .where(eq(reminderInstances.userId, userId))

  const now = new Date()
  for (const row of due) {
    if (row.status === "scheduled" && row.fireAt <= now) {
      await db
        .update(reminderInstances)
        .set({ status: "sent", updatedAt: new Date() })
        .where(eq(reminderInstances.id, row.id))
    }
  }
}
