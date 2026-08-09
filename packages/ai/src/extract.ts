import type { ExtractionResult } from "@workspace/core"
import { extractionResultSchema } from "@workspace/core"
import { chatCompletion } from "./client"
import { intentsToExtraction } from "./intent-extract"

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
  return intentsToExtraction(raw)
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
