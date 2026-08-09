import type { ExtractionResult } from "@workspace/core"
import { extractionResultSchema } from "@workspace/core"
import { chatCompletion } from "./client"

const SYSTEM = `You extract structured life objects from ADHD-friendly capture dumps.
Return ONLY valid JSON matching:
{"candidates":[{"type":"task|event|routine|energy|person|preference|note","title":"...","data":{},"confidence":0.0-1.0}],"summary":"..."}
Rules:
- Prefer short task titles.
- energy: data.level = low|medium|high, optional notes.
- event: data.start/end ISO if present.
- Never shame. Be precise.`

/** Heuristic extractor when no API key is configured. */
export function heuristicExtract(raw: string): ExtractionResult {
  const candidates: ExtractionResult["candidates"] = []
  const text = raw.trim()
  const lower = text.toLowerCase()

  if (/(low energy|foggy|tired|exhausted|poor sleep)/.test(lower)) {
    candidates.push({
      type: "energy",
      title: "Energy note",
      data: {
        level: "low",
        notes: text.slice(0, 120),
      },
      confidence: 0.75,
    })
  } else if (/(high energy|focused|wired)/.test(lower)) {
    candidates.push({
      type: "energy",
      title: "Energy note",
      data: { level: "high", notes: text.slice(0, 120) },
      confidence: 0.7,
    })
  }

  const taskish = text
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .filter(
      (s) =>
        /^(call|buy|email|finish|schedule|pay|book|fix|send|write|meet)/i.test(
          s
        ) ||
        /\b(need to|todo|to-do|remind me)\b/i.test(s)
    )

  for (const t of taskish.slice(0, 5)) {
    candidates.push({
      type: "task",
      title: t.replace(/^(need to|todo|remind me to)\s*/i, "").slice(0, 80),
      data: {
        priority: /urgent|asap|critical/i.test(t) ? "high" : "medium",
        energyCost: /deep work|focus/i.test(t) ? "high" : "medium",
        estimatedDuration: 30,
      },
      confidence: 0.65,
    })
  }

  const personMatch = text.match(/\b(?:mom|dad|boss|[A-Z][a-z]+)\b/)
  if (personMatch && /gift|call|meet|birthday|with/i.test(text)) {
    candidates.push({
      type: "person",
      title: personMatch[0],
      data: { name: personMatch[0] },
      confidence: 0.55,
    })
  }

  if (candidates.length === 0) {
    candidates.push({
      type: "note",
      title: "Life note",
      data: { rawText: text },
      confidence: 0.9,
    })
  }

  return {
    candidates,
    summary: `Understood ${candidates.length} item(s) from your capture.`,
  }
}

export async function extractLifeObjects(raw: string): Promise<ExtractionResult> {
  const result = await chatCompletion({
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: raw },
    ],
    temperature: 0.1,
  })

  if (result.offline || !result.content) {
    return heuristicExtract(raw)
  }

  try {
    const parsed = JSON.parse(
      result.content.replace(/^```json\n?|\n?```$/g, "").trim()
    )
    return extractionResultSchema.parse(parsed)
  } catch {
    return heuristicExtract(raw)
  }
}
