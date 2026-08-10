import type { Db } from "@workspace/db"
import { consolidateNotes, ingestText } from "@workspace/mind"

/** Best-effort MIND ingest — never fail the user-facing action. */
export async function rememberFact(
  db: Db,
  userId: string,
  text: string,
  sourceType = "life_action",
  sourceId?: string
) {
  const trimmed = text.trim()
  if (!trimmed) return
  try {
    await ingestText(db, {
      userId,
      text: trimmed,
      sourceType,
      sourceId,
    })
  } catch (e) {
    console.warn("rememberFact failed", e)
  }
}

export async function rememberExchange(
  db: Db,
  userId: string,
  userText: string,
  assistantText: string,
  sourceId?: string
) {
  await rememberFact(
    db,
    userId,
    `User: ${userText}\nAssistant: ${assistantText}`,
    "converse",
    sourceId
  )
}

export async function rememberConsolidation(
  db: Db,
  userId: string,
  summaryText: string
) {
  try {
    await consolidateNotes(db, userId, summaryText)
  } catch (e) {
    console.warn("rememberConsolidation failed", e)
  }
}
