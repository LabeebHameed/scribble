"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"

type Hit = {
  chunkId: string
  content: string
  sourceType: string
  score: number
}

type Note = { id: string; rawText: string; timestamp: string }

export default function MemoryPage() {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const [notes, setNotes] = useState<Note[]>([])

  async function load() {
    const res = await fetch("/api/memory")
    if (res.status === 401) {
      window.location.href = "/login"
      return
    }
    const data = await res.json()
    setNotes(data.notes || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function search() {
    const res = await fetch(`/api/memory?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setHits(data.hits || [])
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Memory</h1>
        <p className="text-sm text-muted-foreground">
          Transparent view of the thin MIND layer — searchable life history.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search memory…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button onClick={search}>Search</Button>
      </div>

      {hits.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Hits</h2>
          {hits.map((h) => (
            <div key={h.chunkId} className="rounded-xl border border-border/70 bg-card/70 p-3">
              <div className="mb-1 flex gap-2">
                <Badge variant="secondary">{h.sourceType}</Badge>
                <span className="text-xs text-muted-foreground">
                  score {h.score.toFixed(2)}
                </span>
              </div>
              <p className="text-sm">{h.content}</p>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Recent notes</h2>
        {notes.map((n) => (
          <div key={n.id} className="rounded-xl border border-border/60 p-3 text-sm">
            {n.rawText}
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Captures and chat will appear here after ingest.
          </p>
        )}
      </section>
    </div>
  )
}
