import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { getDb, routines } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const rows = await db.select().from(routines).where(eq(routines.userId, user.id))
    return json({ routines: rows })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.title) return badRequest("title required")
    const db = getDb()
    const [row] = await db
      .insert(routines)
      .values({
        userId: user.id,
        title: body.title,
        preferredWindows: body.preferredWindows ?? [],
        minDuration: body.minDuration ?? null,
        idealDuration: body.idealDuration ?? null,
        maxDuration: body.maxDuration ?? null,
        priority: body.priority ?? "medium",
        recurrenceRule: body.recurrenceRule ?? null,
        energyProfile: body.energyProfile ?? null,
        flexibility: body.flexibility ?? "soft",
        checklist: body.checklist ?? [],
      })
      .returning()
    return json({ routine: row }, { status: 201 })
  })
}
