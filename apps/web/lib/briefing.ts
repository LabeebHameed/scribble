import { chatCompletion } from "@workspace/ai"
import type { GlancePayload } from "@/lib/glance"
import type { NextAction, PlateItem } from "@/lib/next-action"

export type BriefingInput = {
  glance: GlancePayload
  plate: PlateItem[]
  energy: "low" | "medium" | "high" | null
  memoryHits: Array<{ content: string }>
  actions: Array<{ kind: string; summary: string }>
  nextAction: NextAction
  ask?: string | null
  needsReply?: boolean
}

function templateBriefing(input: BriefingInput): string {
  if (input.needsReply && input.ask) return input.ask

  const parts: string[] = []
  const openCount = input.plate.filter((p) => p.kind === "task").length
  const events = input.glance.nextUp.filter((b) => b.kind === "event").length
  const attention = input.glance.needsAttention.length

  if (input.nextAction.source !== "none") {
    const title = input.nextAction.title.replace(/[.!?]+$/, "")
    parts.push(`Next: ${title}. ${input.nextAction.reason}`)
  } else {
    parts.push(input.nextAction.reason)
  }

  const dayBits: string[] = []
  if (openCount) dayBits.push(`${openCount} open task${openCount === 1 ? "" : "s"}`)
  if (attention) dayBits.push(`${attention} needing attention`)
  if (input.glance.now) dayBits.push(`now in “${input.glance.now.title}”`)
  else if (input.glance.nextUp[0]) {
    const t = new Date(input.glance.nextUp[0].start).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
    dayBits.push(`next up ${input.glance.nextUp[0].title} at ${t}`)
  }
  if (events) dayBits.push(`${events} upcoming event block${events === 1 ? "" : "s"}`)
  if (input.energy) dayBits.push(`${input.energy} energy`)
  if (dayBits.length) parts.push(`Today: ${dayBits.join("; ")}.`)

  const acted = input.actions.filter((a) =>
    ["task", "event", "reminder", "energy", "plan"].includes(a.kind)
  )
  if (acted.length) {
    parts.push(`I logged: ${acted.map((a) => a.summary).join("; ")}.`)
  }

  const hint = input.memoryHits[0]?.content?.replace(/\s+/g, " ").slice(0, 120)
  if (hint && /user:|assistant:|created|meeting|remind/i.test(hint)) {
    parts.push(`From memory: ${hint}`)
  }

  return parts.join(" ").replace(/\s+/g, " ").trim()
}

/** Deterministic briefing; optional cheap LLM polish when OPENAI_API_KEY is set. */
export async function buildBriefing(input: BriefingInput): Promise<string> {
  const base = templateBriefing(input)
  if (!process.env.OPENAI_API_KEY || input.needsReply) return base

  try {
    const result = await chatCompletion({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "Rewrite this ADHD life-assistant briefing in 2 short spoken sentences. Calm, concrete, no shame. Keep the next action. Return plain text only.",
        },
        { role: "user", content: base },
      ],
    })
    if (!result.offline && result.content?.trim()) {
      return result.content.trim().slice(0, 500)
    }
  } catch (e) {
    console.warn("briefing polish failed", e)
  }
  return base
}
