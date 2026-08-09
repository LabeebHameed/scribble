import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { eq } from "drizzle-orm"
import { getDb, sessions, users } from "@workspace/db"

const COOKIE = "scribble_session"

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const next = scryptSync(password, salt, 64)
  const prev = Buffer.from(hash, "hex")
  if (next.length !== prev.length) return false
  return timingSafeEqual(next, prev)
}

export async function createSession(userId: string) {
  const db = getDb()
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db.insert(sessions).values({ userId, token, expiresAt })
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })
  return token
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) {
    const db = getDb()
    await db.delete(sessions).where(eq(sessions.token, token))
    jar.delete(COOKIE)
  }
}

export async function getCurrentUser() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  const db = getDb()
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      tone: users.tone,
      notificationRules: users.notificationRules,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.token, token))
    .limit(1)
  const user = rows[0]
  if (!user) return null
  return user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("UNAUTHORIZED")
  return user
}

export function stableId(...parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)
}
