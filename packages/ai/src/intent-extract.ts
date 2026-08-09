import type { ExtractionResult } from "@workspace/core"
import { parseIntents } from "./intent"

/** Map parsed intents to extraction candidates for capture flow. */
export function intentsToExtraction(raw: string): ExtractionResult {
  const intents = parseIntents(raw)
  const candidates: ExtractionResult["candidates"] = []

  for (const intent of intents) {
    if (intent.type === "task") {
      candidates.push({
        type: "task",
        title: intent.title,
        data: {
          priority: intent.priority || "medium",
          estimatedDuration: intent.estimatedDuration || 30,
          deadline: intent.deadline?.toISOString(),
        },
        confidence: 0.8,
      })
    } else if (intent.type === "event") {
      candidates.push({
        type: "event",
        title: intent.title,
        data: {
          start: intent.start.toISOString(),
          end: intent.end.toISOString(),
          isFixed: true,
        },
        confidence: 0.85,
      })
    } else if (intent.type === "reminder") {
      candidates.push({
        type: "task",
        title: intent.title,
        data: {
          priority: "medium",
          estimatedDuration: 15,
          reminderAt: intent.fireAt.toISOString(),
          actionLanguage: intent.actionLanguage,
        },
        confidence: 0.9,
      })
    } else if (intent.type === "energy") {
      candidates.push({
        type: "energy",
        title: "Energy note",
        data: { level: intent.level, notes: intent.notes },
        confidence: 0.75,
      })
    }
  }

  if (candidates.length === 0) {
    candidates.push({
      type: "note",
      title: "Life note",
      data: { rawText: raw },
      confidence: 0.5,
    })
  }

  return {
    candidates,
    summary: `Parsed ${candidates.length} item(s) from your capture.`,
  }
}
