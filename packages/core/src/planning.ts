import type { EnergyLevel, Priority, Task } from "./schemas"

export type PlanSlot = {
  start: Date
  end: Date
  taskId: string
  title: string
  reason: string
}

export type PlanProposal = {
  slots: PlanSlot[]
  warnings: string[]
  ritualFocus: string[]
}

export type PlannerInput = {
  dayStart: Date
  dayEnd: Date
  tasks: Task[]
  fixedBlocks: { start: Date; end: Date; title: string }[]
  routineWindows: {
    id: string
    title: string
    start: Date
    end: Date
    idealDuration?: number | null
    priority: Priority
    flexibility: "rigid" | "soft" | "highly_flexible"
  }[]
  energy?: EnergyLevel | null
  workingHours?: { startHour: number; endHour: number }
}

const priorityWeight: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd
}

function isUrgent(task: Task, now = new Date()) {
  if (task.priority === "critical" || task.priority === "high") return true
  if (!task.deadline) return false
  const deadline = new Date(task.deadline)
  const hours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  return hours <= 48
}

/** Selective auto-place: only duration + deadline/urgency candidates. */
export function selectAutoPlaceCandidates(tasks: Task[]) {
  return tasks
    .filter(
      (t) =>
        t.status === "open" ||
        t.status === "in_progress"
    )
    .filter((t) => t.estimatedDuration && (t.deadline || isUrgent(t)))
    .sort((a, b) => {
      const dw =
        priorityWeight[b.priority] - priorityWeight[a.priority]
      if (dw !== 0) return dw
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity
      return ad - bd
    })
}

export function proposeDayPlan(input: PlannerInput): PlanProposal {
  const {
    dayStart,
    dayEnd,
    tasks,
    fixedBlocks,
    energy,
    workingHours = { startHour: 9, endHour: 18 },
  } = input

  const warnings: string[] = []
  const slots: PlanSlot[] = []
  const occupied = [...fixedBlocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )

  const workStart = new Date(dayStart)
  workStart.setHours(workingHours.startHour, 0, 0, 0)
  const workEnd = new Date(dayStart)
  workEnd.setHours(workingHours.endHour, 0, 0, 0)

  const candidates = selectAutoPlaceCandidates(tasks).filter((t) => {
    if (!energy) return true
    if (energy === "low" && t.energyCost === "high") {
      warnings.push(
        `Skipped high-energy task “${t.title}” while energy is low.`
      )
      return false
    }
    return true
  })

  let cursor = workStart > dayStart ? workStart : new Date(dayStart)

  for (const task of candidates) {
    const durationMs = (task.estimatedDuration ?? 30) * 60 * 1000
    let placed = false

    while (cursor.getTime() + durationMs <= workEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + durationMs)
      const conflict = occupied.find((b) =>
        overlaps(cursor, slotEnd, b.start, b.end)
      )
      if (conflict) {
        cursor = new Date(conflict.end)
        continue
      }

      // Soft routines may be displaced — we just place after fixed blocks.
      slots.push({
        start: new Date(cursor),
        end: slotEnd,
        taskId: task.id,
        title: task.title,
        reason: task.deadline
          ? `Duration + deadline (${task.deadline})`
          : `Duration + urgency (${task.priority})`,
      })
      occupied.push({ start: new Date(cursor), end: slotEnd, title: task.title })
      occupied.sort((a, b) => a.start.getTime() - b.start.getTime())
      cursor = slotEnd
      placed = true
      break
    }

    if (!placed) {
      warnings.push(`Could not fit “${task.title}” into working hours.`)
    }
  }

  const totalMinutes = occupied.reduce((sum, b) => {
    if (b.start < workStart || b.end > workEnd) return sum
    return sum + (b.end.getTime() - b.start.getTime()) / 60000
  }, 0)
  const capacity = (workingHours.endHour - workingHours.startHour) * 60
  if (totalMinutes > capacity * 0.85) {
    warnings.push("Day looks over capacity — consider dropping or shrinking blocks.")
  }

  const ritualFocus = candidates.slice(0, 3).map((t) => t.title)

  return { slots, warnings, ritualFocus }
}

export function breakdownTask(
  title: string,
  spiciness: 1 | 2 | 3 | 4 | 5 = 3
): string[] {
  const count = Math.min(2 + spiciness, 8)
  const verbs = [
    "Open",
    "Gather",
    "Draft",
    "Review",
    "Send",
    "Confirm",
    "File",
    "Follow up",
  ]
  return Array.from({ length: count }, (_, i) => {
    const verb = verbs[i % verbs.length]
    return `${verb}: ${title} (step ${i + 1})`
  })
}
