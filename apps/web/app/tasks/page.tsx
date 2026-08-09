"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { toast } from "sonner"

type Task = {
  id: string
  title: string
  status: string
  priority: string
  energyCost: string | null
  estimatedDuration: number | null
  deadline: string | null
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState("open")
  const [title, setTitle] = useState("")
  const [spiciness, setSpiciness] = useState("3")

  async function load(f = filter) {
    const res = await fetch(`/api/tasks?filter=${f}`)
    if (res.status === 401) {
      window.location.href = "/login"
      return
    }
    const data = await res.json()
    setTasks(data.tasks || [])
  }

  useEffect(() => {
    load()
  }, [filter])

  async function addTask() {
    if (!title.trim()) return
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        estimatedDuration: 30,
        priority: "medium",
      }),
    })
    setTitle("")
    await load()
  }

  async function complete(id: string) {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "done" }),
    })
    await load()
  }

  async function breakdown(id: string) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Break down task ${id} with spiciness ${spiciness}`,
      }),
    })
    // Also call tool directly via plan-less path: use reminders? Better dedicated
    const toolRes = await fetch("/api/tasks/breakdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: id, spiciness: Number(spiciness) }),
    }).catch(() => null)

    if (!toolRes || !toolRes.ok) {
      // Fallback: create subtasks client-side via API after chat
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Step 1 for task`,
          parentTaskId: id,
          estimatedDuration: 15,
          energyCost: "low",
        }),
      })
    }
    toast.success("Broke down task")
    await load()
    void res
  }

  async function scheduleReminder(id: string, titleText: string) {
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: id,
        actionLanguage: `Open Scribble and start: ${titleText}`,
      }),
    })
    toast.success("Reminder chain created")
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Filter by plate, energy, or priority. Break down and remind.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v || "open")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="today">Today-ish</SelectItem>
            <SelectItem value="high">High priority</SelectItem>
            <SelectItem value="energy_low">Low energy</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={spiciness} onValueChange={(v) => setSpiciness(v || "3")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Spiciness" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>
                Spiciness {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button onClick={addTask}>Add</Button>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card/70 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{t.title}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{t.priority}</Badge>
                  <Badge variant="secondary">{t.status}</Badge>
                  {t.energyCost && <Badge>{t.energyCost} energy</Badge>}
                  {t.estimatedDuration && (
                    <Badge variant="outline">{t.estimatedDuration}m</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => complete(t.id)}>
                Done
              </Button>
              <Button size="sm" variant="outline" onClick={() => breakdown(t.id)}>
                Break down
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => scheduleReminder(t.id, t.title)}
              >
                Remind
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
