import { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { getDb, events } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const rows = await db.select().from(events).where(eq(events.userId, user.id))
    return json({ events: rows })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.title || !body.start || !body.end) return badRequest("title, start, end required")
    const db = getDb()
    const [row] = await db
      .insert(events)
      .values({
        userId: user.id,
        title: body.title,
        start: new Date(body.start),
        end: new Date(body.end),
        location: body.location ?? null,
        link: body.link ?? null,
        notes: body.notes ?? null,
        isFixed: body.isFixed ?? true,
      })
      .returning()
    return json({ event: row }, { status: 201 })
  })
}

export async function DELETE(req: NextRequest) {
  return withAuth(async (user) => {
    const id = req.nextUrl.searchParams.get("id")
    if (!id) return badRequest("id required")
    const db = getDb()
    await db.delete(events).where(and(eq(events.id, id), eq(events.userId, user.id)))
    return json({ ok: true })
  })
}
