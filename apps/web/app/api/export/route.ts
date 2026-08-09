import { eq } from "drizzle-orm"
import {
  captures,
  energyNotes,
  events,
  getDb,
  lifeNotes,
  people,
  preferences,
  routines,
  tasks,
  users,
} from "@workspace/db"
import { json, withAuth } from "@/lib/api"

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const payload = {
      exportedAt: new Date().toISOString(),
      user: await db.select().from(users).where(eq(users.id, user.id)),
      tasks: await db.select().from(tasks).where(eq(tasks.userId, user.id)),
      events: await db.select().from(events).where(eq(events.userId, user.id)),
      routines: await db.select().from(routines).where(eq(routines.userId, user.id)),
      energyNotes: await db
        .select()
        .from(energyNotes)
        .where(eq(energyNotes.userId, user.id)),
      people: await db.select().from(people).where(eq(people.userId, user.id)),
      preferences: await db
        .select()
        .from(preferences)
        .where(eq(preferences.userId, user.id)),
      captures: await db.select().from(captures).where(eq(captures.userId, user.id)),
      lifeNotes: await db
        .select()
        .from(lifeNotes)
        .where(eq(lifeNotes.userId, user.id)),
    }

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="scribble-export.json"`,
      },
    })
  })
}

export async function DELETE() {
  return withAuth(async (user) => {
    const db = getDb()
    // Cascade deletes via user FK
    await db.delete(users).where(eq(users.id, user.id))
    return json({ deleted: true })
  })
}
