import Constants from "expo-constants"

export function apiBase() {
  const url =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
    "http://localhost:3000"
  return url.replace(/\/$/, "")
}

export type Glance = {
  now: { title: string; start: string; end: string } | null
  needsAttention: Array<{ id: string; message: string; title: string; stage: string }>
  nextUp: Array<{ title: string; start: string; end: string; kind: string }>
}

export type PlateItem = {
  id: string
  title: string
  kind: "task" | "reminder" | "event"
  status: string
}

export type NextAction = {
  title: string
  reason: string
  source: "reminder" | "block" | "task" | "none"
  id?: string
}

export type AssistantState = {
  nextAction: NextAction
  why: string
  plateCount: number
  memoryHints: string[]
}

export type ConverseResponse = {
  transcript?: string
  reply?: string
  needsReply?: boolean
  sessionId?: string
  audioBase64?: string | null
  audioMime?: string | null
  glance?: Glance
  plate?: PlateItem[]
  assistant?: AssistantState
  error?: string
}

export function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return ""
  }
}
