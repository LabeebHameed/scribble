import { NextResponse } from "next/server"
import { getSql } from "@workspace/db"

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        ok: false,
        status: "degraded",
        db: "not_configured",
        message: "Set DATABASE_URL in Vercel project settings (Neon or Vercel Postgres).",
      },
      { status: 503 }
    )
  }

  try {
    const sql = getSql()
    await sql`select 1 as ok`
    return NextResponse.json({
      ok: true,
      status: "healthy",
      db: "connected",
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "degraded",
        db: "error",
        message: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 503 }
    )
  }
}
