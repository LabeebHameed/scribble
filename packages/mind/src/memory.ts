import { and, eq, sql } from "drizzle-orm"
import type { Db } from "@workspace/db"
import { embeddings, lifeNotes, memoryChunks } from "@workspace/db"
import { chunkText, contentHash, cosineSimilarity, hashEmbed } from "./embed"

export type EmbedFn = (text: string) => Promise<number[]>

export async function defaultEmbed(text: string): Promise<number[]> {
  const mode = process.env.EMBEDDING_MODE || "hash"
  if (mode === "api" && process.env.OPENAI_API_KEY) {
    const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small"
    const res = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: text }),
    })
    if (!res.ok) {
      console.warn("Embedding API failed, falling back to hash", await res.text())
      return hashEmbed(text)
    }
    const json = (await res.json()) as {
      data: { embedding: number[] }[]
    }
    const emb = json.data[0]?.embedding
    if (!emb) return hashEmbed(text)
    // Pad/truncate to 384 for schema consistency in MVP
    if (emb.length === 384) return emb
    if (emb.length > 384) return emb.slice(0, 384)
    return [...emb, ...new Array(384 - emb.length).fill(0)]
  }
  return hashEmbed(text)
}

export async function ingestText(
  db: Db,
  opts: {
    userId: string
    text: string
    sourceType: string
    sourceId?: string
    embed?: EmbedFn
  }
) {
  const embed = opts.embed ?? defaultEmbed
  const hash = contentHash(opts.text)

  // Content-hash skip: if identical life note already exists for user, skip re-embed
  const existingNote = await db
    .select()
    .from(lifeNotes)
    .where(
      and(eq(lifeNotes.userId, opts.userId), eq(lifeNotes.contentHash, hash))
    )
    .limit(1)

  if (existingNote[0] && opts.sourceType === "life_note") {
    return { skipped: true as const, noteId: existingNote[0].id, chunkIds: [] as string[] }
  }

  const notes = await db
    .insert(lifeNotes)
    .values({
      userId: opts.userId,
      rawText: opts.text,
      contentHash: hash,
    })
    .returning()
  const note = notes[0]
  if (!note) throw new Error("Failed to insert life note")

  const chunks = chunkText(opts.text)
  const chunkIds: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i]!
    const ch = contentHash(content)
    const rows = await db
      .insert(memoryChunks)
      .values({
        userId: opts.userId,
        sourceType: opts.sourceType,
        sourceId: opts.sourceId ?? note.id,
        chunkIndex: i,
        content,
        contentHash: ch,
      })
      .returning()
    const row = rows[0]
    if (!row) continue

    const vector = await embed(content)
    await db.insert(embeddings).values({
      chunkId: row.id,
      embedding: vector,
      dims: vector.length,
    })
    chunkIds.push(row.id)
  }

  return { skipped: false as const, noteId: note.id, chunkIds }
}

export type MemoryHit = {
  chunkId: string
  content: string
  sourceType: string
  sourceId: string | null
  score: number
}

/** Hybrid FTS + dense retrieval with simple merge. */
export async function hybridSearch(
  db: Db,
  opts: {
    userId: string
    query: string
    limit?: number
    embed?: EmbedFn
  }
): Promise<MemoryHit[]> {
  const limit = opts.limit ?? 8
  const embed = opts.embed ?? defaultEmbed
  const queryVec = await embed(opts.query)

  // Dense: load user embeddings (fine for personal MVP scale)
  const denseRows = await db
    .select({
      chunkId: memoryChunks.id,
      content: memoryChunks.content,
      sourceType: memoryChunks.sourceType,
      sourceId: memoryChunks.sourceId,
      embedding: embeddings.embedding,
    })
    .from(memoryChunks)
    .innerJoin(embeddings, eq(embeddings.chunkId, memoryChunks.id))
    .where(eq(memoryChunks.userId, opts.userId))

  const denseScores = new Map<string, MemoryHit>()
  for (const row of denseRows) {
    const score = cosineSimilarity(queryVec, row.embedding as number[])
    denseScores.set(row.chunkId, {
      chunkId: row.chunkId,
      content: row.content,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      score,
    })
  }

  // FTS via to_tsvector
  const fts = await db.execute(sql`
    SELECT id, content, source_type, source_id,
      ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${opts.query})) AS rank
    FROM memory_chunks
    WHERE user_id = ${opts.userId}::uuid
      AND to_tsvector('english', content) @@ plainto_tsquery('english', ${opts.query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `)

  const merged = new Map<string, MemoryHit>()
  for (const hit of denseScores.values()) {
    merged.set(hit.chunkId, { ...hit, score: hit.score })
  }

  for (const row of fts as unknown as Array<{
    id: string
    content: string
    source_type: string
    source_id: string | null
    rank: number
  }>) {
    const existing = merged.get(row.id)
    const ftsScore = Number(row.rank) || 0
    if (existing) {
      existing.score = existing.score * 0.6 + ftsScore * 0.4 + 0.05
    } else {
      merged.set(row.id, {
        chunkId: row.id,
        content: row.content,
        sourceType: row.source_type,
        sourceId: row.source_id,
        score: ftsScore,
      })
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export async function consolidateNotes(
  db: Db,
  userId: string,
  summaryText: string
) {
  return ingestText(db, {
    userId,
    text: summaryText,
    sourceType: "consolidation",
  })
}
