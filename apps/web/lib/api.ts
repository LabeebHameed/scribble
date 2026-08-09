import { NextResponse } from "next/server"

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 })
}

export function badRequest(message: string) {
  return json({ error: message }, { status: 400 })
}

export async function withAuth<T>(
  handler: (user: { id: string; email: string; name: string | null; tone: string | null }) => Promise<T>
) {
  try {
    const { requireUser } = await import("./auth")
    const user = await requireUser()
    return await handler(user)
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized()
    console.error(e)
    return json({ error: "Internal error" }, { status: 500 })
  }
}
