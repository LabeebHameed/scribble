import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { getDb, isDatabaseConfigured, users } from "@workspace/db"
import { createSession, hashPassword, verifyPassword } from "@/lib/auth"
import { badRequest, json } from "@/lib/api"

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    action?: "login" | "register" | "demo"
    email?: string
    password?: string
    name?: string
  }

  if (!isDatabaseConfigured()) {
    return json(
      {
        error:
          "Database not configured. Connect Neon on Vercel, then POST /api/setup with x-setup-secret.",
      },
      { status: 503 }
    )
  }

  const db = getDb()

  if (body.action === "demo") {
    const email = "demo@scribble.app"
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
    let user = rows[0]
    if (!user) {
      return badRequest("Demo user missing. Run pnpm db:seed")
    }
    await createSession(user.id)
    return json({ user: { id: user.id, email: user.email, name: user.name } })
  }

  if (!body.email || !body.password) return badRequest("Email and password required")

  if (body.action === "register") {
    const existing = await db.select().from(users).where(eq(users.email, body.email)).limit(1)
    if (existing[0]) return badRequest("Email already registered")
    const inserted = await db
      .insert(users)
      .values({
        email: body.email,
        name: body.name || body.email.split("@")[0],
        passwordHash: hashPassword(body.password),
      })
      .returning()
    const created = inserted[0]
    if (!created) return badRequest("Could not create user")
    await createSession(created.id)
    return json({
      user: { id: created.id, email: created.email, name: created.name },
    })
  }

  const rows = await db.select().from(users).where(eq(users.email, body.email)).limit(1)
  const user = rows[0]
  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return json({ error: "Invalid credentials" }, { status: 401 })
  }
  await createSession(user.id)
  return json({ user: { id: user.id, email: user.email, name: user.name } })
}

export async function DELETE() {
  const { destroySession } = await import("@/lib/auth")
  await destroySession()
  return json({ ok: true })
}

export async function GET() {
  const { getCurrentUser } = await import("@/lib/auth")
  const user = await getCurrentUser()
  if (!user) return json({ user: null })
  return json({ user })
}
