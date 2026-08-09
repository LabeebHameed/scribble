import { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { breakdownTask } from "@workspace/core"
import { getDb, tasks } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.taskId) return badRequest("taskId required")
    const db = getDb()
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, body.taskId), eq(tasks.userId, user.id)))
      .limit(1)
    const parent = rows[0]
    if (!parent) return badRequest("not found")
    const spiciness = Math.min(5, Math.max(1, Number(body.spiciness) || 3)) as
      | 1
      | 2
      | 3
      | 4
      | 5
    const steps = breakdownTask(parent.title, spiciness)
    const created = []
    for (const title of steps) {
      const [t] = await db
        .insert(tasks)
        .values({
          userId: user.id,
          title,
          parentTaskId: parent.id,
          priority: parent.priority,
          energyCost: "low",
          estimatedDuration: 15,
        })
        .returning()
      created.push(t)
    }
    return json({ subtasks: created })
  })
}
