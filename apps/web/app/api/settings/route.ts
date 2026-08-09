import { eq } from "drizzle-orm"
import { getDb, users } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET() {
  return withAuth(async (user) => json({ user }))
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.tone) return badRequest("tone required")
    const db = getDb()
    const updated = await db
      .update(users)
      .set({
        tone: body.tone,
        notificationRules: body.notificationRules ?? {},
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()
    const row = updated[0]
    if (!row) return badRequest("Could not update settings")
    return json({ user: { id: row.id, tone: row.tone } })
  })
}
