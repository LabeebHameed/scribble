import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getDb, isDatabaseConfigured, runMigrations, users } from "@workspace/db"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-setup-secret")
  const expected = process.env.SETUP_SECRET || process.env.AUTH_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "No database URL. Neon should set DATABASE_URL or POSTGRES_URL on Vercel.",
      },
      { status: 503 }
    )
  }

  try {
    await runMigrations()

    const db = getDb()
    const email = "demo@scribble.app"
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
    if (!rows[0]) {
      await db.insert(users).values({
        email,
        name: "Demo",
        passwordHash: "disabled",
      })
    }

    return NextResponse.json({
      ok: true,
      message: "Migrations applied and default user ensured.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Setup failed"
    return NextResponse.json(
      {
        error: message,
        hint:
          "Enable the pgvector extension in Neon (CREATE EXTENSION vector) if migration fails on vector type.",
      },
      { status: 500 }
    )
  }
}
