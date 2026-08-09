import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { getDb, people } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const rows = await db.select().from(people).where(eq(people.userId, user.id))
    return json({ people: rows })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.name) return badRequest("name required")
    const db = getDb()
    const [row] = await db
      .insert(people)
      .values({
        userId: user.id,
        name: body.name,
        relationship: body.relationship ?? null,
        notes: body.notes ?? null,
      })
      .returning()
    return json({ person: row }, { status: 201 })
  })
}
