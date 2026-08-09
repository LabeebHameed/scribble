"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "sonner"

export default function SettingsPage() {
  const [user, setUser] = useState<{ email: string; name: string | null; tone: string | null } | null>(null)
  const [tone, setTone] = useState("calm")
  const [nag, setNag] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) window.location.href = "/login"
        setUser(d.user)
        setTone(d.user?.tone || "calm")
      })

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => setOfflineReady(true))
        .catch(() => setOfflineReady(false))
    }

    // Cache today's plan snapshot for offline
    caches.open("scribble-offline-v1").then(async (cache) => {
      try {
        await cache.addAll(["/today", "/api/plan", "/api/reminders"])
      } catch {
        /* ignore offline warm failures */
      }
    })
  }, [])

  async function saveTone() {
    // Persist via preference + user tone update endpoint-lite using export? Add quick PATCH on auth
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tone,
        notificationRules: { allowPersistentNag: nag },
      }),
    })
    toast.success("Settings saved")
  }

  async function exportData() {
    window.location.href = "/api/export"
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" })
    window.location.href = "/login"
  }

  async function deleteAll() {
    if (!confirm("Delete all your Scribble data? This cannot be undone.")) return
    await fetch("/api/export", { method: "DELETE" })
    window.location.href = "/login"
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Tone, notifications, ownership. Signed in as {user?.email}
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4">
        <Label>Personality tone</Label>
        <Select value={tone} onValueChange={(v) => setTone(v || "calm")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="calm">Calm</SelectItem>
            <SelectItem value="direct">Direct</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="playful">Playful</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Allow persistent nag mode</p>
            <p className="text-xs text-muted-foreground">
              Only for a tiny set of high-value items
            </p>
          </div>
          <Switch checked={nag} onCheckedChange={setNag} />
        </div>
        <Button onClick={saveTone}>Save</Button>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 p-4">
        <p className="text-sm font-medium">Offline</p>
        <p className="text-xs text-muted-foreground">
          {offlineReady
            ? "Service worker registered — Today + recent plan cached when online."
            : "Service worker not available in this browser context."}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <Button variant="outline" onClick={exportData}>
          Export my data
        </Button>
        <Button variant="secondary" onClick={logout}>
          Sign out
        </Button>
        <Button variant="destructive" onClick={deleteAll}>
          Delete account & data
        </Button>
      </section>
    </div>
  )
}
