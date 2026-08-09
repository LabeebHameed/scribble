import { NextRequest } from "next/server"
import { getDb, events } from "@workspace/db"
import { badRequest, json, withAuth } from "@/lib/api"

/** Basic calendar import — ICS-ish JSON list of events (read-only import). */
export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    const items = body.events as Array<{
      title: string
      start: string
      end: string
      location?: string
      notes?: string
    }>
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest("events array required")
    }
    const db = getDb()
    const created = []
    for (const item of items) {
      const [row] = await db
        .insert(events)
        .values({
          userId: user.id,
          title: item.title,
          start: new Date(item.start),
          end: new Date(item.end),
          location: item.location ?? null,
          notes: item.notes ?? null,
          isFixed: true,
        })
        .returning()
      created.push(row)
    }
    return json({ imported: created.length, events: created })
  })
}
