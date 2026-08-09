"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "sonner"

type Candidate = {
  type: string
  title?: string
  data?: Record<string, unknown>
  confidence?: number
}

type Msg = { id: string; role: string; content: string }

function describeCreated(created: Array<{ type?: string; title?: string }>) {
  if (!created.length) return "Saved to memory"
  const labels = created.map((c) => {
    if (c.type === "task") return `task: ${c.title}`
    return c.type || "item"
  })
  return `Saved ${labels.join(", ")}`
}

export default function CapturePage() {
  const [raw, setRaw] = useState("")
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [captureId, setCaptureId] = useState<string | null>(null)
  const [summary, setSummary] = useState("")
  const [messages, setMessages] = useState<Msg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []))
  }, [])

  async function capture(autoConfirm: boolean) {
    if (!raw.trim()) return
    setBusy(true)
    try {
      const res = await fetch("/api/captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: raw, autoConfirm }),
      })
      const data = await res.json()
      if (autoConfirm) {
        toast.success(describeCreated(data.created || []))
        setRaw("")
        setCandidates([])
        setCaptureId(null)
        setSummary("")
        return
      }
      setCaptureId(data.capture.id)
      setCandidates(data.extracted?.candidates || [])
      setSummary(data.extracted?.summary || "")
      toast.success("Extracted — confirm what looks right")
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!captureId) return
    const res = await fetch("/api/captures", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: captureId,
        status: "confirmed",
        extracted: { candidates, summary },
      }),
    })
    const data = await res.json()
    toast.success(describeCreated(data.created || []))
    setRaw("")
    setCandidates([])
    setCaptureId(null)
    setSummary("")
  }

  async function dismiss() {
    if (!captureId) return
    await fetch("/api/captures", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: captureId, status: "dismissed" }),
    })
    setCandidates([])
    setCaptureId(null)
    setSummary("")
  }

  async function sendChat() {
    if (!chatInput.trim()) return
    setBusy(true)
    const optimistic = chatInput
    setChatInput("")
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: optimistic },
    ])
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: optimistic }),
      })
      const data = await res.json()
      if (data.message) setMessages((m) => [...m, data.message])
      if (data.toolResults?.length) {
        toast.success(
          data.toolResults
            .map((t: { name: string }) => t.name)
            .join(", ")
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Capture</h1>
        <p className="text-sm text-muted-foreground">
          Tasks, reminders, energy notes, people — say it once here or in chat.
          No separate task list to maintain.
        </p>
      </div>

      <Tabs defaultValue="capture">
        <TabsList>
          <TabsTrigger value="capture">Dump</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="capture" className="flex flex-col gap-3">
          <Textarea
            rows={5}
            placeholder="Call dentist Tuesday, buy Mom a birthday gift, low energy today…"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => capture(true)}>
              Capture & save
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => capture(false)}>
              Review first
            </Button>
          </div>
          {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
          {candidates.map((c, i) => (
            <div
              key={`${c.type}-${i}`}
              className="flex items-start justify-between gap-2 rounded-xl border border-border/70 bg-card/70 p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{c.type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((c.confidence || 0) * 100)}%
                  </span>
                </div>
                <p className="font-medium">{c.title || JSON.stringify(c.data)}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setCandidates((list) => list.filter((_, idx) => idx !== i))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          {candidates.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={confirm}>Confirm & save</Button>
              <Button variant="outline" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="chat" className="flex flex-col gap-3">
          <div className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto rounded-xl border border-border/60 bg-background/70 p-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                “Remind me to call the dentist”, “what’s on my plate?”, “plan today”…
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "mr-8 rounded-xl bg-muted px-3 py-2 text-sm"
                }
              >
                {m.content}
              </div>
            ))}
          </div>
          <Textarea
            rows={2}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Talk to Scribble — tasks, plans, memory…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendChat()
              }
            }}
          />
          <Button disabled={busy} onClick={sendChat}>
            Send
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}
