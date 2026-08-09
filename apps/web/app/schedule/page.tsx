"use client"

import { useEffect, useState } from "react"
import { format, parseISO } from "date-fns"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { toast } from "sonner"

type Block = {
  id: string
  title: string
  kind: string
  start: string
  end: string
  isProposal: boolean
  accepted: boolean | null
}

type EventRow = {
  id: string
  title: string
  start: string
  end: string
  isFixed: boolean
}

export default function SchedulePage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [routines, setRoutines] = useState<{ id: string; title: string }[]>([])

  async function load() {
    const [p, e, r] = await Promise.all([
      fetch("/api/plan"),
      fetch("/api/events"),
      fetch("/api/routines"),
    ])
    if (p.status === 401) {
      window.location.href = "/login"
      return
    }
    setBlocks((await p.json()).blocks || [])
    setEvents((await e.json()).events || [])
    setRoutines((await r.json()).routines || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function importSample() {
    const start = new Date()
    start.setHours(11, 0, 0, 0)
    const end = new Date(start.getTime() + 45 * 60000)
    await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            title: "Imported lunch buffer",
            start: start.toISOString(),
            end: end.toISOString(),
            notes: "Basic calendar import",
          },
        ],
      }),
    })
    toast.success("Imported sample calendar event")
    await load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">
            Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            Day view mixing fixed events, planned blocks, and soft routines.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={importSample}>
          Import sample
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Fixed events</h2>
        {events.map((e) => (
          <div key={e.id} className="rounded-xl border border-border/70 bg-card/70 p-3">
            <div className="flex items-center gap-2">
              <Badge>fixed</Badge>
              <span className="font-medium">{e.title}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(e.start), "EEE h:mm a")} –{" "}
              {format(parseISO(e.end), "h:mm a")}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Planned blocks</h2>
        {blocks.map((b) => (
          <div key={b.id} className="rounded-xl border border-border/70 bg-background/80 p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{b.kind}</Badge>
              {b.isProposal && <Badge variant="outline">proposal</Badge>}
              <span className="font-medium">{b.title}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(b.start), "h:mm a")} –{" "}
              {format(parseISO(b.end), "h:mm a")}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Routines</h2>
        {routines.map((r) => (
          <div key={r.id} className="rounded-xl border border-dashed border-border p-3">
            <p className="font-medium">{r.title}</p>
            <p className="text-xs text-muted-foreground">
              Soft window — may yield to higher priority
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
