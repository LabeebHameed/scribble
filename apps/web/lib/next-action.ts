import type { GlancePayload } from "@/lib/glance"

export type PlateItem = {
  id: string
  title: string
  kind: "task" | "reminder" | "event"
  status: string
  priority?: string | null
  energyCost?: string | null
  estimatedDuration?: number | null
  deadline?: string | null
}

export type NextAction = {
  title: string
  reason: string
  source: "reminder" | "block" | "task" | "none"
  id?: string
}

export function chooseNextAction(opts: {
  glance: GlancePayload
  plate: PlateItem[]
  energy: "low" | "medium" | "high" | null
  memoryHints?: string[]
}): NextAction {
  const { glance, plate, energy } = opts

  if (glance.needsAttention[0]) {
    return {
      title: glance.needsAttention[0].message,
      reason: "This needs attention now.",
      source: "reminder",
      id: glance.needsAttention[0].id,
    }
  }

  if (glance.now) {
    return {
      title: glance.now.title,
      reason: "You're in this block right now.",
      source: "block",
    }
  }

  const tasks = plate.filter((p) => p.kind === "task" && p.status !== "done")
  const sorted = [...tasks].sort((a, b) => {
    const score = (t: PlateItem) => {
      let s = 0
      if (t.priority === "critical") s += 40
      if (t.priority === "high") s += 30
      if (t.priority === "medium") s += 10
      if (t.deadline) {
        const hours =
          (new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60)
        if (hours <= 24) s += 25
        else if (hours <= 48) s += 15
      }
      const dur = t.estimatedDuration ?? 30
      if (energy === "low") {
        if (t.energyCost === "high") s -= 20
        if (dur <= 20) s += 15
      }
      if (energy === "high" && t.energyCost === "high") s += 10
      return s
    }
    return score(b) - score(a)
  })

  if (sorted[0]) {
    const t = sorted[0]
    const why =
      energy === "low"
        ? "Low energy — start with something small."
        : t.deadline
          ? "Due soon, so it comes first."
          : "Best next open item on your plate."
    return {
      title: t.title,
      reason: why,
      source: "task",
      id: t.id,
    }
  }

  if (glance.nextUp[0]) {
    const when = new Date(glance.nextUp[0].start).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
    return {
      title: glance.nextUp[0].title,
      reason: `Coming up at ${when}.`,
      source: "block",
    }
  }

  return {
    title: "Nothing queued",
    reason: "Tell me a task, meeting, or reminder and I'll shape the day.",
    source: "none",
  }
}
