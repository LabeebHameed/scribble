import { NextRequest } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import {
  chatCompletion,
  personalitySystemPrompt,
  SCRIBBLE_TOOLS,
} from "@workspace/ai"
import { breakdownTask, proposeDayPlan } from "@workspace/core"
import {
  chatMessages,
  energyNotes,
  events,
  getDb,
  reminderChains,
  reminderInstances,
  scheduledBlocks,
  tasks,
} from "@workspace/db"
import { hybridSearch, ingestText } from "@workspace/mind"
import { badRequest, json, withAuth } from "@/lib/api"

async function runTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
) {
  const db = getDb()
  switch (name) {
    case "create_task": {
      const [t] = await db
        .insert(tasks)
        .values({
          userId,
          title: String(args.title),
          description: (args.description as string) || null,
          priority: (args.priority as "medium") || "medium",
          energyCost: (args.energyCost as "medium") || null,
          estimatedDuration: (args.estimatedDuration as number) || null,
          deadline: args.deadline ? new Date(String(args.deadline)) : null,
        })
        .returning()
      return t
    }
    case "update_task": {
      const [t] = await db
        .update(tasks)
        .set({
          ...(args.title ? { title: String(args.title) } : {}),
          ...(args.status ? { status: args.status as "open" } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, String(args.id)), eq(tasks.userId, userId)))
        .returning()
      return t
    }
    case "complete_task": {
      const [t] = await db
        .update(tasks)
        .set({ status: "done", completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tasks.id, String(args.id)), eq(tasks.userId, userId)))
        .returning()
      return t
    }
    case "add_energy_note": {
      const [e] = await db
        .insert(energyNotes)
        .values({
          userId,
          level: args.level as "low" | "medium" | "high",
          notes: (args.notes as string) || null,
        })
        .returning()
      return e
    }
    case "search_memory": {
      return hybridSearch(db, {
        userId,
        query: String(args.query),
        limit: 6,
      })
    }
    case "generate_plan": {
      const taskRows = await db.select().from(tasks).where(eq(tasks.userId, userId))
      const eventRows = await db.select().from(events).where(eq(events.userId, userId))
      const energy = await db
        .select()
        .from(energyNotes)
        .where(eq(energyNotes.userId, userId))
        .orderBy(desc(energyNotes.timestamp))
        .limit(1)
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date()
      dayEnd.setHours(23, 59, 59, 999)
      const proposal = proposeDayPlan({
        dayStart,
        dayEnd,
        tasks: taskRows.map((t) => ({
          id: t.id,
          userId: t.userId,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          energyCost: t.energyCost,
          estimatedDuration: t.estimatedDuration,
          deadline: t.deadline?.toISOString() ?? null,
          preferredWindows: (t.preferredWindows as []) ?? [],
          project: t.project,
          area: t.area,
          parentTaskId: t.parentTaskId,
          sourceCaptureId: t.sourceCaptureId,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          completedAt: t.completedAt?.toISOString() ?? null,
        })),
        fixedBlocks: eventRows.map((e) => ({
          start: e.start,
          end: e.end,
          title: e.title,
        })),
        routineWindows: [],
        energy: energy[0]?.level ?? null,
      })

      for (const slot of proposal.slots) {
        await db.insert(scheduledBlocks).values({
          userId,
          kind: "task",
          title: slot.title,
          start: slot.start,
          end: slot.end,
          taskId: slot.taskId,
          isProposal: true,
          accepted: null,
        })
      }
      return proposal
    }
    case "set_reminder": {
      const inserted = await db
        .insert(reminderChains)
        .values({
          userId,
          title: "Reminder",
          actionLanguage: String(args.actionLanguage),
          taskId: String(args.taskId),
          persistentNag: Boolean(args.persistentNag),
        })
        .returning()
      const chain = inserted[0]
      if (!chain) return { error: "Could not create reminder" }
      const now = Date.now()
      await db.insert(reminderInstances).values([
        {
          chainId: chain.id,
          userId,
          stage: "prep",
          status: "scheduled",
          fireAt: new Date(now + 60 * 60 * 1000),
          message: `Prep: ${args.actionLanguage}`,
        },
        {
          chainId: chain.id,
          userId,
          stage: "action",
          status: "scheduled",
          fireAt: new Date(now + 2 * 60 * 60 * 1000),
          message: String(args.actionLanguage),
        },
        {
          chainId: chain.id,
          userId,
          stage: "final",
          status: "scheduled",
          fireAt: new Date(now + 4 * 60 * 60 * 1000),
          message: `Final nudge — ${args.actionLanguage}`,
        },
      ])
      return chain
    }
    case "break_down_task": {
      const taskRows = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, String(args.taskId)), eq(tasks.userId, userId)))
        .limit(1)
      const parent = taskRows[0]
      if (!parent) return { error: "task not found" }
      const spiciness = Math.min(
        5,
        Math.max(1, Number(args.spiciness) || 3)
      ) as 1 | 2 | 3 | 4 | 5
      const steps = breakdownTask(parent.title, spiciness)
      const created = []
      for (const title of steps) {
        const [t] = await db
          .insert(tasks)
          .values({
            userId,
            title,
            parentTaskId: parent.id,
            priority: parent.priority,
            energyCost: "low",
            estimatedDuration: 15,
            status: "open",
          })
          .returning()
        created.push(t)
      }
      return { parentId: parent.id, subtasks: created }
    }
    default:
      return { error: `Unknown tool ${name}` }
  }
}

export async function GET() {
  return withAuth(async (user) => {
    const db = getDb()
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, user.id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(40)
    return json({ messages: rows.reverse() })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(async (user) => {
    const body = await req.json()
    if (!body.message?.trim()) return badRequest("message required")
    const db = getDb()

    await db.insert(chatMessages).values({
      userId: user.id,
      role: "user",
      content: body.message,
    })

    // Always search memory lightly for grounding
    const memoryHits = await hybridSearch(db, {
      userId: user.id,
      query: body.message,
      limit: 4,
    })

    const history = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, user.id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(12)

    const result = await chatCompletion({
      messages: [
        { role: "system", content: personalitySystemPrompt(user.tone || "calm") },
        {
          role: "system",
          content: `Memory context:\n${memoryHits
            .map((h) => `- ${h.content}`)
            .join("\n") || "(empty)"}`,
        },
        ...history.reverse().map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      tools: SCRIBBLE_TOOLS,
    })

    const toolResults: unknown[] = []
    if (!result.offline && result.toolCalls.length) {
      for (const call of result.toolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.arguments || "{}")
        } catch {
          args = {}
        }
        const out = await runTool(user.id, call.name, args)
        toolResults.push({ name: call.name, result: out })
      }
    }

    let reply =
      result.content ||
      (toolResults.length
        ? `Done — ran ${toolResults.map((t) => (t as { name: string }).name).join(", ")}.`
        : null)

    if (result.offline) {
      // Offline heuristic assistant
      const lower = body.message.toLowerCase()
      if (lower.includes("plate") || lower.includes("today")) {
        const open = await db
          .select()
          .from(tasks)
          .where(eq(tasks.userId, user.id))
        const active = open.filter(
          (t) => t.status === "open" || t.status === "in_progress"
        )
        reply = `Here's what's on your plate: ${
          active.map((t) => t.title).join("; ") || "nothing open yet"
        }.`
      } else if (lower.includes("energy")) {
        reply =
          "Tell me if you're low, medium, or high energy and I'll log it — or say “low energy after poor sleep”."
      } else if (memoryHits[0]) {
        reply = `I found this in memory: “${memoryHits[0].content.slice(0, 200)}”`
      } else {
        reply =
          "I'm here. Capture anything, ask what's on your plate, or ask me to plan today. (LLM offline — heuristic mode.)"
      }

      if (/create task|add task|remind me to/i.test(body.message)) {
        const title = body.message
          .replace(/^(create task|add task|remind me to)\s*/i, "")
          .slice(0, 80)
        const t = await runTool(user.id, "create_task", { title })
        toolResults.push({ name: "create_task", result: t })
        reply = `Created task: ${title}`
      }
    }

    const insertedMsg = await db
      .insert(chatMessages)
      .values({
        userId: user.id,
        role: "assistant",
        content: reply || "Okay.",
        toolCalls: toolResults.length ? toolResults : null,
      })
      .returning()
    const assistant = insertedMsg[0]
    if (!assistant) return badRequest("Could not store assistant message")

    // Light dream: ingest assistant+user exchange facts
    await ingestText(db, {
      userId: user.id,
      text: `User: ${body.message}\nAssistant: ${reply}`,
      sourceType: "chat",
      sourceId: assistant.id,
    })

    return json({ message: assistant, toolResults, memoryHits })
  })
}
