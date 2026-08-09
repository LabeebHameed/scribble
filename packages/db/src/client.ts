import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>
}

export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  if (!globalForDb.sql) {
    const isProd = process.env.NODE_ENV === "production"
    globalForDb.sql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: isProd ? "require" : undefined,
    })
  }
  return globalForDb.sql
}

export function getDb() {
  return drizzle(getSql(), { schema })
}

export type Db = ReturnType<typeof getDb>
