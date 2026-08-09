import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import { getDb, isDatabaseConfigured, users } from "@workspace/db"

const DEFAULT_EMAIL = "demo@scribble.app"

export type AppUser = {
  id: string
  email: string
  name: string | null
  tone: string | null
}

export async function getDefaultUser(): Promise<AppUser> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured")
  }

  const db = getDb()
  const existing = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      tone: users.tone,
    })
    .from(users)
    .where(eq(users.email, DEFAULT_EMAIL))
    .limit(1)

  if (existing[0]) return existing[0]

  const [created] = await db
    .insert(users)
    .values({
      email: DEFAULT_EMAIL,
      name: "Demo",
      passwordHash: "disabled",
      tone: "calm",
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      tone: users.tone,
    })

  if (!created) throw new Error("Could not create default user")
  return created
}

export function stableId(...parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32)
}
