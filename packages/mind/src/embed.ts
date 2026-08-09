import { createHash } from "node:crypto"

export function contentHash(text: string) {
  return createHash("md5").update(text).digest("hex")
}

/** Bound chunks ~500 tokens-ish with overlap (word windows). */
export function chunkText(text: string, maxWords = 180, overlapWords = 20) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  if (words.length <= maxWords) return [words.join(" ")]

  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const slice = words.slice(i, i + maxWords)
    chunks.push(slice.join(" "))
    if (i + maxWords >= words.length) break
    i += Math.max(1, maxWords - overlapWords)
  }
  return chunks
}

/** Deterministic cheap embedding for tests / offline (MIND hash mode). */
export function hashEmbed(text: string, dims = 384): number[] {
  const vec = new Array(dims).fill(0)
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  for (const token of tokens) {
    let h = 2166136261
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const idx = Math.abs(h) % dims
    vec[idx] += 1
    if (token.length >= 3) {
      for (let i = 0; i < token.length - 2; i++) {
        const tri = token.slice(i, i + 3)
        let th = 0
        for (let j = 0; j < tri.length; j++) th = (th * 31 + tri.charCodeAt(j)) >>> 0
        vec[th % dims] += 0.35
      }
    }
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

export function cosineSimilarity(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  return dot / ((Math.sqrt(na) || 1) * (Math.sqrt(nb) || 1))
}
