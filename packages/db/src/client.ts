import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { getRuntimeDatabaseUrl } from "./env"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>
}

function sslOption(url: string) {
  if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
    return "require" as const
  }
  return undefined
}

export function getSql() {
  const url = getRuntimeDatabaseUrl()
  if (!url) throw new Error("DATABASE_URL is not set")
  if (!globalForDb.sql) {
    globalForDb.sql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      ssl: sslOption(url),
    })
  }
  return globalForDb.sql
}

export function getDb() {
  return drizzle(getSql(), { schema })
}

export type Db = ReturnType<typeof getDb>
