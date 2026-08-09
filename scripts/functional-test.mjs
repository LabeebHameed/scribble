#!/usr/bin/env node
/**
 * Scribble functional integration tests — exercises live API like a user would.
 * Run: node scripts/functional-test.mjs
 * Env: SCRIBBLE_BASE_URL (default http://localhost:3000)
 */
const BASE = process.env.SCRIBBLE_BASE_URL || "http://localhost:3000"

const results = []
let pass = 0
let fail = 0

function ok(name) {
  pass++
  results.push(`PASS: ${name}`)
  console.log(`  ✓ ${name}`)
}
function bad(name, detail) {
  fail++
  results.push(`FAIL: ${name} — ${detail}`)
  console.log(`  ✗ ${name} — ${detail}`)
}
function section(title) {
  console.log(`\n=== ${title} ===`)
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return { status: res.status, json: JSON.parse(text) }
  } catch {
    return { status: res.status, json: null, text }
  }
}

async function main() {
  section("0. Health")
  const health = await api("GET", "/api/health")
  if (health.json?.ok) ok("health endpoint")
  else bad("health endpoint", JSON.stringify(health.json || health.text))

  section("1. Capture: remind me to drink water in 5 minutes")
  const cap1 = await api("POST", "/api/captures", {
    rawText: "remind me to drink water in 5 minutes",
    autoConfirm: true,
  })
  const c1 = cap1.json?.created || []
  console.log("  created:", c1.map((c) => `${c.type}:${c.title || c.actionLanguage || ""}`).join(", "))
  if (c1.some((c) => c.type === "task")) ok("capture creates task")
  else bad("capture task", "missing")
  if (c1.some((c) => c.type === "reminder")) ok("capture schedules reminder")
  else bad("capture reminder", "missing")

  section("2. Capture: meeting at 3:30")
  const cap2 = await api("POST", "/api/captures", {
    rawText: "I have a meeting at 3:30 with the team",
    autoConfirm: true,
  })
  const c2 = cap2.json?.created || []
  console.log("  created:", c2.map((c) => `${c.type}:${c.title}`).join(", "))
  if (c2.some((c) => c.type === "event")) ok("capture creates event")
  else bad("capture event", "missing")

  section("3. Capture: call mom tomorrow")
  const cap3 = await api("POST", "/api/captures", {
    rawText: "call mom tomorrow",
    autoConfirm: true,
  })
  if ((cap3.json?.created || []).some((c) => c.type === "task")) ok("capture call task")
  else bad("call mom", "missing task")

  section("4. Capture: low energy")
  const cap4 = await api("POST", "/api/captures", {
    rawText: "low energy today, foggy brain",
    autoConfirm: true,
  })
  if ((cap4.json?.created || []).some((c) => c.type === "energy")) ok("capture energy")
  else bad("energy", "missing")

  section("5. Chat: remind me to stretch in 10 minutes")
  const chat1 = await api("POST", "/api/chat", {
    message: "remind me to stretch in 10 minutes",
  })
  const r1 = chat1.json?.message?.content || ""
  console.log("  reply:", r1.slice(0, 100))
  if (/reminder/i.test(r1)) ok("chat sets reminder")
  else bad("chat reminder", r1)

  section("6. Chat: meeting at 3:30")
  const chat2 = await api("POST", "/api/chat", {
    message: "I have a meeting at 3:30 with Sarah",
  })
  const r2 = chat2.json?.message?.content || ""
  console.log("  reply:", r2.slice(0, 120))
  if (/event|meeting|3:30/i.test(r2)) ok("chat handles meeting")
  else bad("chat meeting", r2)

  section("7. Chat: plan my day")
  const chat3 = await api("POST", "/api/chat", { message: "plan my day" })
  const r3 = chat3.json?.message?.content || ""
  console.log("  reply:", r3.slice(0, 120))
  if (/proposed|block|today|plan/i.test(r3)) ok("chat plans day")
  else bad("chat plan", r3)

  section("8. Chat: what's on my plate")
  const chat4 = await api("POST", "/api/chat", {
    message: "what is on my plate today",
  })
  const r4 = chat4.json?.message?.content || ""
  console.log("  reply:", r4.slice(0, 120))
  if (r4.length > 10) ok("chat lists tasks")
  else bad("chat list", "empty")

  section("9. Plan timeline")
  const plan = await api("GET", "/api/plan")
  const blocks = plan.json?.blocks?.length || 0
  console.log("  blocks:", blocks)
  if (blocks >= 1) ok("timeline has blocks")
  else bad("timeline", "empty")

  section("10. Schedule events")
  const events = await api("GET", "/api/events")
  const ev = events.json?.events?.length || 0
  console.log("  events:", ev)
  if (ev >= 1) ok("events on schedule")
  else bad("schedule events", "none")

  section("11. Due reminders")
  const tasks = await api("GET", "/api/tasks?filter=open")
  const tid = tasks.json?.tasks?.[0]?.id
  if (tid) {
    await api("POST", "/api/reminders", {
      taskId: tid,
      actionLanguage: "Drink water now",
      fireInMinutes: 0,
    })
    await new Promise((r) => setTimeout(r, 500))
    const rems = await api("GET", "/api/reminders")
    const needs = rems.json?.needsAttention?.length || 0
    console.log("  needsAttention:", needs)
    if (needs >= 1) ok("due reminders surface")
    else bad("reminders due", "needsAttention empty")
  } else bad("reminders due", "no task")

  section("12. Memory search")
  const mem = await api("GET", "/api/memory?q=water")
  const hits = mem.json?.hits?.length || 0
  if (hits >= 1) ok("memory search")
  else bad("memory", "no hits")

  section("13. Chat: call dentist next week")
  const chat5 = await api("POST", "/api/chat", {
    message: "I need to call the dentist next week",
  })
  const r5 = chat5.json?.message?.content || ""
  console.log("  reply:", r5.slice(0, 100))
  if (/task|dentist/i.test(r5)) ok("chat creates task from need")
  else bad("chat task", r5)

  section("14. Today quick capture path")
  const cap5 = await api("POST", "/api/captures", {
    rawText: "buy groceries on the way home",
    autoConfirm: true,
  })
  if ((cap5.json?.created || []).some((c) => c.type === "task")) ok("quick capture materializes")
  else bad("quick capture", "no task created")

  console.log("\n=== SUMMARY ===")
  console.log(`Passed: ${pass}  Failed: ${fail}`)
  for (const r of results) console.log(r)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
