import { NextRequest } from "next/server"
import { desc, eq } from "drizzle-orm"
import { getDb, energyNotes } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const rows = await db
      .select()
      .from(energyNotes)
      .where(eq(energyNotes.userId, user.id))
      .orderBy(desc(energyNotes.timestamp))
      .limit(20)
    return json({ energyNotes: rows })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.level) return badRequest("level required")
    const db = getDb()
    const [row] = await db
      .insert(energyNotes)
      .values({
        userId: user.id,
        level: body.level,
        notes: body.notes ?? null,
        affectsHours: body.affectsHours ?? 4,
      })
      .returning()
    return json({ energyNote: row }, { status: 201 })
  })
}
