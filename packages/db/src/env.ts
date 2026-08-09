/**
 * Resolve Postgres URLs from Vercel/Neon integration env vars.
 * Neon on Vercel may expose pooled + direct URLs under different names.
 */
export function getRuntimeDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    null
  )
}

export function getMigrateDatabaseUrl() {
  return (
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    null
  )
}

export function isDatabaseConfigured() {
  return Boolean(getRuntimeDatabaseUrl())
}
