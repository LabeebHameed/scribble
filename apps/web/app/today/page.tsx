"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { format, parseISO } from "date-fns"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "sonner"
import { NeedsAttention } from "@/components/reminders/needs-attention"

type Block = {
  id: string
  title: string
  kind: string
  start: string
  end: string
  isProposal: boolean
  accepted: boolean | null
}

type Reminder = {
  id: string
  message: string
  stage: string
  status: string
  title: string
  actionLanguage: string
}

export default function TodayPage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [ritual, setRitual] = useState("")
  const [warnings, setWarnings] = useState<string[]>([])
  const [focus, setFocus] = useState<string[]>([])
  const [pending, startTransition] = useTransition()
  const [quick, setQuick] = useState("")

  const load = useCallback(async () => {
    const [planRes, remRes] = await Promise.all([
      fetch("/api/plan"),
      fetch("/api/reminders"),
    ])
    if (planRes.status === 401 || remRes.status === 401) {
      window.location.href = "/login"
      return
    }
    const plan = await planRes.json()
    const rem = await remRes.json()
    setBlocks(plan.blocks || [])
    setReminders(rem.needsAttention || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const now = useMemo(() => new Date(), [blocks])
  const current = blocks.find((b) => {
    const s = new Date(b.start)
    const e = new Date(b.end)
    return s <= now && now <= e && b.accepted !== false
  })

  function planToday(energy?: string) {
    startTransition(async () => {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose", energy }),
      })
      const data = await res.json()
      setWarnings(data.proposal?.warnings || [])
      setFocus(data.proposal?.ritualFocus || [])
      await load()
      toast.success("Plan proposed — accept or reject each block")
    })
  }

  async function accept(id: string) {
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept", blockId: id }),
    })
    await load()
  }

  async function reject(id: string) {
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", blockId: id }),
    })
    await load()
  }

  async function quickCapture() {
    if (!quick.trim()) return
    const res = await fetch("/api/captures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: quick }),
    })
    if (res.ok) {
      toast.success("Captured — review in Capture")
      setQuick("")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {format(new Date(), "EEEE, MMM d")}
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight animate-in fade-in duration-500">
          Today
        </h1>
        <p className="text-sm text-muted-foreground">
          Visual timeline first. Auto-place only when duration + urgency exist.
        </p>
      </section>

      <NeedsAttention
        items={reminders}
        onChange={load}
      />

      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 animate-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Daily ritual</h2>
          <Button size="sm" variant="ghost" onClick={() => planToday()}>
            Plan today
          </Button>
        </div>
        <Textarea
          placeholder="What are the 1–3 things that matter today?"
          value={ritual}
          onChange={(e) => setRitual(e.target.value)}
          rows={2}
        />
        {focus.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {focus.map((f) => (
              <Badge key={f} variant="secondary">
                {f}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => planToday("low")}>
            Replan · low energy
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => planToday()}>
            What’s realistic?
          </Button>
        </div>
        {warnings.map((w) => (
          <p key={w} className="text-xs text-amber-800 dark:text-amber-200">
            {w}
          </p>
        ))}
      </section>

      {current && (
        <section className="rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-sm animate-in zoom-in-95 duration-300">
          <p className="text-xs uppercase tracking-wide opacity-80">Now</p>
          <p className="font-[family-name:var(--font-display)] text-xl">{current.title}</p>
          <p className="text-xs opacity-80">
            {format(parseISO(current.start), "h:mm a")} –{" "}
            {format(parseISO(current.end), "h:mm a")}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <div className="relative flex flex-col gap-2 border-l-2 border-primary/25 pl-4">
          {blocks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No blocks yet. Capture something or tap Plan today.
            </p>
          )}
          {blocks
            .slice()
            .sort((a, b) => +new Date(a.start) - +new Date(b.start))
            .map((b) => (
              <div
                key={b.id}
                className="relative rounded-xl border border-border/60 bg-background/80 p-3 transition hover:border-primary/40"
              >
                <span className="absolute -left-[1.35rem] top-4 size-2.5 rounded-full bg-primary" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(b.start), "h:mm a")} –{" "}
                      {format(parseISO(b.end), "h:mm a")} · {b.kind}
                    </p>
                    <p className="font-medium">{b.title}</p>
                  </div>
                  {b.isProposal && b.accepted == null && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => accept(b.id)}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => reject(b.id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                  {b.isProposal === false || b.accepted ? (
                    <Badge variant="outline">locked</Badge>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Quick capture</h2>
        <Textarea
          placeholder="Dump anything…"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          rows={2}
        />
        <Button onClick={quickCapture}>Capture</Button>
      </section>
    </div>
  )
}
