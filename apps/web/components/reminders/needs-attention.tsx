"use client"

import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { toast } from "sonner"

type Item = {
  id: string
  message: string
  stage: string
  status: string
  title: string
  actionLanguage: string
}

export function NeedsAttention({
  items,
  onChange,
}: {
  items: Item[]
  onChange: () => void
}) {
  if (!items.length) return null

  async function act(id: string, action: string, minutes?: number) {
    await fetch("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, minutes }),
    })
    toast.message(action === "complete" ? "Marked complete" : `Snoozed ${minutes}m`)
    onChange()
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-50/80 p-4 dark:bg-amber-950/30">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-2 border-t border-amber-500/20 pt-3 first:border-0 first:pt-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {item.title} · {item.stage}
          </p>
          <p className="text-sm font-medium">{item.message}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => act(item.id, "complete")}>
              Complete
            </Button>
            <Button size="sm" variant="outline" onClick={() => act(item.id, "snooze", 15)}>
              Snooze 15m
            </Button>
            <Button size="sm" variant="outline" onClick={() => act(item.id, "snooze", 60)}>
              Snooze 1h
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act(item.id, "acknowledge")}>
              Open
            </Button>
          </div>
        </div>
      ))}
    </section>
  )
}
