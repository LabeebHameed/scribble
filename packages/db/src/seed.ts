import "dotenv/config"
import { eq } from "drizzle-orm"
import { getDb, getSql } from "./client"
import {
  energyNotes,
  events,
  people,
  preferences,
  reminderChains,
  reminderInstances,
  routines,
  scheduledBlocks,
  tasks,
  users,
} from "./schema"

async function main() {
  const db = getDb()
  const email = "demo@scribble.app"
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  let userId = existing[0]?.id

  if (!userId) {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name: "Demo",
        passwordHash: "disabled",
        tone: "calm",
      })
      .returning()
    userId = user.id
    console.log("Created default user demo@scribble.app")
  } else {
    console.log("Demo user already exists")
  }

  const taskCount = await db.select().from(tasks).where(eq(tasks.userId, userId))
  if (taskCount.length === 0) {
    const now = new Date()
    const later = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    const evening = new Date(now)
    evening.setHours(17, 0, 0, 0)

    const [person] = await db
      .insert(people)
      .values({
        userId,
        name: "Mom",
        relationship: "family",
        notes: "Birthday gift still open",
      })
      .returning()

    const [t1] = await db
      .insert(tasks)
      .values({
        userId,
        title: "Call the dentist",
        description: "Book cleaning for next month",
        priority: "high",
        energyCost: "low",
        estimatedDuration: 15,
        deadline: new Date(now.getTime() + 36 * 60 * 60 * 1000),
        status: "open",
      })
      .returning()

    const [t2] = await db
      .insert(tasks)
      .values({
        userId,
        title: "Buy birthday gift",
        priority: "medium",
        energyCost: "medium",
        estimatedDuration: 45,
        deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        status: "open",
      })
      .returning()

    await db.insert(tasks).values({
      userId,
      title: "Deep work: Scribble planning notes",
      priority: "medium",
      energyCost: "high",
      estimatedDuration: 90,
      preferredWindows: [{ label: "morning" }],
      status: "open",
    })

    const meetStart = new Date(now)
    meetStart.setHours(15, 0, 0, 0)
    const meetEnd = new Date(meetStart.getTime() + 60 * 60 * 1000)
    const [ev] = await db
      .insert(events)
      .values({
        userId,
        title: "Sync with teammate",
        start: meetStart,
        end: meetEnd,
        isFixed: true,
        notes: "Prep: status bullets",
      })
      .returning()

    await db.insert(routines).values({
      userId,
      title: "Morning stretch",
      preferredWindows: [{ days: "Mon-Fri", start: "09:00", end: "11:00" }],
      idealDuration: 20,
      flexibility: "soft",
      energyProfile: "low",
      priority: "low",
    })

    await db.insert(energyNotes).values({
      userId,
      level: "medium",
      notes: "Okay after coffee",
      affectsHours: 4,
    })

    await db.insert(preferences).values({
      userId,
      type: "working_hours",
      value: { startHour: 9, endHour: 18 },
      strength: "hard",
    })

    await db.insert(scheduledBlocks).values([
      {
        userId,
        kind: "event",
        title: ev.title,
        start: meetStart,
        end: meetEnd,
        eventId: ev.id,
        isProposal: false,
        accepted: true,
      },
      {
        userId,
        kind: "task",
        title: t1.title,
        start: later,
        end: new Date(later.getTime() + 15 * 60 * 1000),
        taskId: t1.id,
        isProposal: true,
        accepted: null,
      },
    ])

    const [chain] = await db
      .insert(reminderChains)
      .values({
        userId,
        title: "Dentist call",
        actionLanguage: "Open your phone and call the dentist to book a cleaning.",
        taskId: t1.id,
        persistentNag: false,
      })
      .returning()

    await db.insert(reminderInstances).values([
      {
        chainId: chain.id,
        userId,
        stage: "prep",
        status: "scheduled",
        fireAt: new Date(now.getTime() + 30 * 60 * 1000),
        message: "Find the dentist number and open your phone.",
      },
      {
        chainId: chain.id,
        userId,
        stage: "action",
        status: "sent",
        fireAt: now,
        message: "Open your phone and call the dentist to book a cleaning.",
      },
    ])

    console.log("Seeded sample life objects", { person: person.name, tasks: [t1.title, t2.title] })
  }

  await getSql().end({ timeout: 5 })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
