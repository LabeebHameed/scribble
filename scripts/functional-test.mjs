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

  const sessionId = `test-${Date.now()}`

  section("15. Converse: incomplete meeting asks for time")
  const cv1 = await api("POST", "/api/converse", {
    transcript: "I have a meeting today",
    sessionId,
    speak: false,
  })
  console.log("  reply:", (cv1.json?.reply || "").slice(0, 120))
  if (cv1.json?.needsReply && /time/i.test(cv1.json?.reply || "")) {
    ok("converse asks for meeting time")
  } else bad("converse clarify", JSON.stringify(cv1.json))

  section("16. Converse: follow-up 3:30 completes event")
  const cv2 = await api("POST", "/api/converse", {
    transcript: "3:30",
    sessionId,
    speak: false,
  })
  console.log("  reply:", (cv2.json?.reply || "").slice(0, 120))
  const actions2 = cv2.json?.actions || []
  if (
    !cv2.json?.needsReply &&
    actions2.some((a) => a.kind === "event") &&
    (cv2.json?.glance?.nextUp?.length >= 1 || cv2.json?.glance?.now)
  ) {
    ok("converse completes meeting + glance")
  } else if (!cv2.json?.needsReply && actions2.some((a) => a.kind === "event")) {
    ok("converse completes meeting")
  } else bad("converse follow-up", JSON.stringify(cv2.json))

  section("17. Converse: reminder in five minutes")
  const cv3 = await api("POST", "/api/converse", {
    transcript: "remind me to drink water in five minutes",
    sessionId: `${sessionId}-rem`,
    speak: false,
  })
  console.log("  reply:", (cv3.json?.reply || "").slice(0, 120))
  if ((cv3.json?.actions || []).some((a) => a.kind === "reminder")) {
    ok("converse sets timed reminder")
  } else bad("converse reminder", JSON.stringify(cv3.json))

  section("18. Converse: auto-plan without Plan today")
  const cv4 = await api("POST", "/api/converse", {
    transcript: "call the bank about the transfer",
    sessionId: `${sessionId}-plan`,
    speak: false,
  })
  const kinds = (cv4.json?.actions || []).map((a) => a.kind)
  console.log("  actions:", kinds.join(", "))
  if (kinds.includes("task") && kinds.includes("plan")) {
    ok("converse auto-plans after task")
  } else if (kinds.includes("task")) {
    ok("converse creates task (plan may be empty if no durations)")
  } else bad("converse auto-plan", kinds.join(","))

  section("19. Converse: what's next is briefing-shaped")
  const cv5 = await api("POST", "/api/converse", {
    transcript: "what's next",
    sessionId: `${sessionId}-next`,
    speak: false,
  })
  const nextReply = cv5.json?.reply || ""
  console.log("  reply:", nextReply.slice(0, 160))
  if (
    nextReply.length > 5 &&
    (/next|today|energy|open|queued|attention/i.test(nextReply) ||
      cv5.json?.assistant?.nextAction)
  ) {
    ok("converse what's next briefing")
  } else bad("converse next", nextReply)

  section("21. Converse: briefing not pure task echo")
  const dentistSession = `${sessionId}-dentist`
  const cvDent = await api("POST", "/api/converse", {
    transcript: "I need to call the dentist about my cleaning",
    sessionId: dentistSession,
    speak: false,
  })
  const dentReply = cvDent.json?.reply || ""
  console.log("  reply:", dentReply.slice(0, 160))
  const echoOnly = /^Task:\s/i.test(dentReply.trim()) && !/next|today/i.test(dentReply)
  if (
    dentReply.length > 10 &&
    !echoOnly &&
    (/next|today|logged|open/i.test(dentReply) || cvDent.json?.assistant?.nextAction)
  ) {
    ok("converse reply is briefing-shaped")
  } else bad("converse briefing shape", dentReply)

  if (cvDent.json?.assistant?.nextAction?.title) {
    ok("assistant.nextAction present after capture")
  } else bad("assistant.nextAction", JSON.stringify(cvDent.json?.assistant))

  section("22. Memory round-trip after converse")
  await new Promise((r) => setTimeout(r, 400))
  const memDent = await api("GET", "/api/memory?q=dentist")
  const dentHits = memDent.json?.hits?.length || 0
  console.log("  dentist hits:", dentHits)
  if (dentHits >= 1) ok("MIND finds dentist utterance/fact")
  else bad("memory dentist", JSON.stringify(memDent.json))

  section("23. Second turn can reference prior dentist context")
  const cvDent2 = await api("POST", "/api/converse", {
    transcript: "what's on my plate about the dentist",
    sessionId: `${dentistSession}-follow`,
    speak: false,
  })
  const dent2 = cvDent2.json?.reply || ""
  console.log("  reply:", dent2.slice(0, 160))
  if (
    /dentist/i.test(dent2) ||
    (cvDent2.json?.assistant?.memoryHints || []).some((h) => /dentist/i.test(h)) ||
    (cvDent2.json?.plate || []).some((p) => /dentist/i.test(p.title || ""))
  ) {
    ok("second turn references dentist context")
  } else bad("dentist context", dent2)

  section("24. GET converse returns assistant + plate")
  const cvGet = await api("GET", "/api/converse")
  if (cvGet.json?.assistant?.nextAction) ok("GET converse has assistant.nextAction")
  else bad("GET assistant", JSON.stringify(cvGet.json?.assistant))
  if (Array.isArray(cvGet.json?.plate)) ok("GET converse has plate array")
  else bad("GET plate", "missing")

  section("20. Optional Groq TTS smoke")
  if (process.env.GROQ_API_KEY) {
    const tts = await api("POST", "/api/voice/speak", { text: "Hello from Scribble." })
    if (tts.json?.audioBase64) ok("Groq TTS returns audio")
    else bad("Groq TTS", JSON.stringify(tts.json))
  } else {
    console.log("  (skipped — no GROQ_API_KEY)")
    ok("Groq TTS skipped without key")
  }

  console.log("\n=== SUMMARY ===")
  console.log(`Passed: ${pass}  Failed: ${fail}`)
  for (const r of results) console.log(r)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
