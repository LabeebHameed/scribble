import { NextRequest } from "next/server"
import { desc, eq } from "drizzle-orm"
import { getDb, lifeNotes, memoryChunks } from "@workspace/db"
import { hybridSearch } from "@workspace/mind"
import { badRequest, json, withAuth } from "@/lib/api"

export async function GET(req: NextRequest) {
  return withAuth(async (user) => {
    const q = req.nextUrl.searchParams.get("q")
    const db = getDb()

    if (q?.trim()) {
      const hits = await hybridSearch(db, { userId: user.id, query: q.trim() })
      return json({ hits, query: q })
    }

    const notes = await db
      .select()
      .from(lifeNotes)
      .where(eq(lifeNotes.userId, user.id))
      .orderBy(desc(lifeNotes.timestamp))
      .limit(40)

    const chunks = await db
      .select()
      .from(memoryChunks)
      .where(eq(memoryChunks.userId, user.id))
      .orderBy(desc(memoryChunks.createdAt))
      .limit(40)

    return json({ notes, chunks })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.query) return badRequest("query required")
    const db = getDb()
    const hits = await hybridSearch(db, {
      userId: user.id,
      query: body.query,
      limit: body.limit ?? 8,
    })
    return json({ hits })
  })
}
