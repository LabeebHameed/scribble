"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("demo@scribble.app")
  const [password, setPassword] = useState("scribble")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) router.replace("/today")
      })
      .catch(() => {})
  }, [router])

  async function submit(action: "login" | "register" | "demo") {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed")
        return
      }
      router.replace("/today")
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70dvh] flex-col justify-center gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          Welcome
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight">
          Scribble
        </h1>
        <p className="max-w-md text-muted-foreground">
          Capture anything. Plan realistically. Remember without re-explaining.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card/60 p-5 shadow-[0_20px_60px_-40px_rgba(20,60,50,0.45)]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={loading} onClick={() => submit("login")}>
            Sign in
          </Button>
          <Button
            disabled={loading}
            variant="outline"
            onClick={() => submit("register")}
          >
            Create account
          </Button>
          <Button
            disabled={loading}
            variant="secondary"
            onClick={() => submit("demo")}
          >
            Enter demo
          </Button>
        </div>
      </div>
    </div>
  )
}
