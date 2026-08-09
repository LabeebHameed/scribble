export type LifeIntent =
  | {
      type: "task"
      title: string
      priority?: "low" | "medium" | "high" | "critical"
      estimatedDuration?: number
      deadline?: Date
    }
  | { type: "event"; title: string; start: Date; end: Date }
  | {
      type: "reminder"
      title: string
      actionLanguage: string
      fireAt: Date
    }
  | { type: "energy"; level: "low" | "medium" | "high"; notes?: string }
  | { type: "plan_day" }
  | { type: "list_tasks" }
  | { type: "whats_next" }
  | { type: "memory_query"; query: string }
  | {
      type: "incomplete"
      kind: "event" | "reminder"
      title: string
      missing: Array<"start" | "fireAt">
      ask: string
      partial: Record<string, unknown>
    }

export type PendingClarification = {
  kind: "event" | "reminder"
  title: string
  missing: Array<"start" | "fireAt">
  partial: Record<string, unknown>
  ask: string
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  fifteen: 15,
  thirty: 30,
  sixty: 60,
}

function parseNumberWord(s: string): number | null {
  const n = Number(s)
  if (!Number.isNaN(n)) return n
  return WORD_NUMBERS[s.toLowerCase()] ?? null
}

/** Parse "in 5 minutes", "in five minutes", "in 1 hour" → minutes from now. */
export function parseDelayMinutes(text: string): number | null {
  const lower = text.toLowerCase()
  const m = lower.match(
    /\bin\s+([a-z]+|\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/
  )
  if (!m) return null
  const n = parseNumberWord(m[1]!)
  if (n == null) return null
  const unit = m[2]!
  if (unit.startsWith("hour") || unit.startsWith("hr")) return n * 60
  return n
}

/** Parse clock times including bare "3:30", "3:30pm", "at 3". */
export function parseClockTime(text: string, now = new Date()): Date | null {
  const lower = text.toLowerCase().trim()
  const m =
    lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) ||
    lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/) ||
    lower.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b/)
  if (!m) return null
  let hour = Number(m[1])
  const minute = m[2] ? Number(m[2]) : 0
  const ampm = m[3]
  if (ampm === "pm" && hour < 12) hour += 12
  if (ampm === "am" && hour === 12) hour = 0
  if (!ampm && hour >= 1 && hour <= 7) hour += 12
  if (hour > 23 || minute > 59) return null
  const d = new Date(now)
  d.setHours(hour, minute, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 1)
  return d
}

function stripReminderPrefix(text: string) {
  return text
    .replace(/^remind me (?:to )?/i, "")
    .replace(/\s+in\s+([a-z]+|\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b.*$/i, "")
    .replace(/\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b.*$/i, "")
    .trim()
}

function isMemoryQuery(text: string) {
  return /\b(what did i say|remember when|search memory|find in memory|recall|what do you know about)\b/i.test(
    text
  )
}

function isPlanRequest(text: string) {
  return /\b(plan (my )?day|plan today|what should i do today|what's realistic|schedule my day)\b/i.test(
    text
  )
}

function isListRequest(text: string) {
  return /\b(on my plate|what do i have|open tasks|what's due)\b/i.test(text)
}

function isWhatsNext(text: string) {
  return /\b(what('?s| is) next|what now|what should i do next)\b/i.test(text)
}

function meetingTitle(text: string) {
  const m = text.match(
    /\b(?:have a |got a |there's a |there is a )?(meeting|appointment|sync|standup)(?:\s+with\s+[^,.]+)?/i
  )
  if (!m) return "Meeting"
  const raw = m[0].replace(/^(have a |got a |there's a |there is a )/i, "")
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** Merge a follow-up utterance into a pending clarification. */
export function resolveClarification(
  pending: PendingClarification,
  answer: string,
  now = new Date()
): { intent: LifeIntent | null; stillMissing: PendingClarification | null; ask?: string } {
  const delayMin = parseDelayMinutes(answer)
  const clock = parseClockTime(answer, now)

  if (pending.kind === "event") {
    if (!clock) {
      return {
        intent: null,
        stillMissing: pending,
        ask: "I still need a time — for example, three thirty or at five.",
      }
    }
    const title = pending.title || "Meeting"
    return {
      intent: {
        type: "event",
        title,
        start: clock,
        end: new Date(clock.getTime() + 60 * 60 * 1000),
      },
      stillMissing: null,
    }
  }

  if (pending.kind === "reminder") {
    const fireAt = delayMin
      ? new Date(now.getTime() + delayMin * 60 * 1000)
      : clock
    if (!fireAt) {
      return {
        intent: null,
        stillMissing: pending,
        ask: "When should I remind you — in five minutes, or at a specific time?",
      }
    }
    const title = pending.title || "Reminder"
    return {
      intent: {
        type: "reminder",
        title,
        actionLanguage: title.charAt(0).toUpperCase() + title.slice(1),
        fireAt,
      },
      stillMissing: null,
    }
  }

  return { intent: null, stillMissing: pending, ask: pending.ask }
}

export function parseIntents(raw: string, now = new Date()): LifeIntent[] {
  const text = raw.trim()
  const lower = text.toLowerCase()
  const intents: LifeIntent[] = []

  if (!text) return intents

  if (isMemoryQuery(text)) {
    intents.push({ type: "memory_query", query: text })
    return intents
  }

  if (isWhatsNext(text)) {
    intents.push({ type: "whats_next" })
    return intents
  }

  if (isPlanRequest(text)) {
    intents.push({ type: "plan_day" })
    return intents
  }

  if (isListRequest(text)) {
    intents.push({ type: "list_tasks" })
    return intents
  }

  if (/(low energy|foggy|tired|exhausted|poor sleep)/i.test(lower)) {
    intents.push({ type: "energy", level: "low", notes: text.slice(0, 200) })
  } else if (/(high energy|focused|wired)/i.test(lower)) {
    intents.push({ type: "energy", level: "high", notes: text.slice(0, 200) })
  }

  const delayMin = parseDelayMinutes(text)
  const clock = parseClockTime(text, now)

  // Meeting / appointment — ask for time if missing
  if (/\b(meeting|appointment|sync|standup)\b/i.test(text)) {
    const title = meetingTitle(text)
    if (clock) {
      intents.push({
        type: "event",
        title,
        start: clock,
        end: new Date(clock.getTime() + 60 * 60 * 1000),
      })
    } else {
      intents.push({
        type: "incomplete",
        kind: "event",
        title,
        missing: ["start"],
        ask: `What time is the ${title.toLowerCase()}?`,
        partial: { title },
      })
    }
    return intents
  }

  if (/\bremind me\b/i.test(text)) {
    const title = stripReminderPrefix(text) || "Reminder"
    if (delayMin != null || clock) {
      const fireAt = delayMin
        ? new Date(now.getTime() + delayMin * 60 * 1000)
        : clock!
      intents.push({
        type: "reminder",
        title,
        actionLanguage: title.charAt(0).toUpperCase() + title.slice(1),
        fireAt,
      })
    } else {
      intents.push({
        type: "incomplete",
        kind: "reminder",
        title,
        missing: ["fireAt"],
        ask: "When should I remind you?",
        partial: { title },
      })
    }
    return intents
  }

  const taskVerbs =
    /^(call|buy|email|finish|schedule|pay|book|fix|send|write|meet|pick up|drop off)\b/i
  const segments = text
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)

  for (const seg of segments) {
    if (taskVerbs.test(seg) || /\b(need to|todo|to-do)\b/i.test(seg)) {
      const title = seg
        .replace(/^(need to|todo|to-do)\s*/i, "")
        .replace(/\s+tomorrow\b/i, "")
        .slice(0, 100)
      const deadline = /\btomorrow\b/i.test(seg)
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 17, 0, 0, 0)
        : undefined
      intents.push({
        type: "task",
        title,
        priority: /urgent|asap|critical/i.test(seg) ? "high" : "medium",
        estimatedDuration: 30,
        deadline,
      })
    }
  }

  if (intents.length === 0 && text.length > 3) {
    intents.push({
      type: "task",
      title: text.slice(0, 100),
      estimatedDuration: 30,
      priority: "medium",
    })
  }

  return intents
}
