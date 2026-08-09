import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  customType,
} from "drizzle-orm/pg-core"

export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "in_progress",
  "done",
  "dropped",
])
export const priorityEnum = pgEnum("priority", [
  "critical",
  "high",
  "medium",
  "low",
])
export const energyLevelEnum = pgEnum("energy_level", ["low", "medium", "high"])
export const flexibilityEnum = pgEnum("flexibility", [
  "rigid",
  "soft",
  "highly_flexible",
])
export const preferenceStrengthEnum = pgEnum("preference_strength", [
  "hard",
  "soft",
])
export const captureStatusEnum = pgEnum("capture_status", [
  "pending",
  "confirmed",
  "dismissed",
])
export const reminderStageEnum = pgEnum("reminder_stage", [
  "day_before",
  "prep",
  "action",
  "final",
  "nag",
])
export const reminderStatusEnum = pgEnum("reminder_status", [
  "scheduled",
  "sent",
  "acknowledged",
  "snoozed",
  "completed",
  "cancelled",
])
export const blockKindEnum = pgEnum("block_kind", [
  "task",
  "event",
  "routine",
  "break",
  "buffer",
])

// Fallback vector type helper if drizzle vector import differs by version
const embeddingVector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(384)"
  },
  toDriver(value: number[]) {
    return `[${value.join(",")}]`
  },
  fromDriver(value: unknown) {
    if (typeof value === "string") {
      return value
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(",")
        .map((v) => Number(v.trim()))
    }
    return value as number[]
  },
})

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  tone: text("tone").default("calm"),
  notificationRules: jsonb("notification_rules").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("open"),
    priority: priorityEnum("priority").notNull().default("medium"),
    energyCost: energyLevelEnum("energy_cost"),
    estimatedDuration: integer("estimated_duration"),
    deadline: timestamp("deadline", { withTimezone: true }),
    preferredWindows: jsonb("preferred_windows")
      .$type<Array<{ label?: string; start?: string; end?: string }>>()
      .default([]),
    project: text("project"),
    area: text("area"),
    parentTaskId: uuid("parent_task_id"),
    sourceCaptureId: uuid("source_capture_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("tasks_user_idx").on(t.userId),
    index("tasks_status_idx").on(t.status),
  ]
)

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
  location: text("location"),
  link: text("link"),
  notes: text("notes"),
  isFixed: boolean("is_fixed").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const routines = pgTable("routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  preferredWindows: jsonb("preferred_windows")
    .$type<Array<Record<string, unknown>>>()
    .default([]),
  minDuration: integer("min_duration"),
  idealDuration: integer("ideal_duration"),
  maxDuration: integer("max_duration"),
  priority: priorityEnum("priority").notNull().default("medium"),
  recurrenceRule: text("recurrence_rule"),
  energyProfile: energyLevelEnum("energy_profile"),
  flexibility: flexibilityEnum("flexibility").notNull().default("soft"),
  checklist: jsonb("checklist").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const energyNotes = pgTable("energy_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  level: energyLevelEnum("level").notNull(),
  notes: text("notes"),
  affectsHours: integer("affects_hours").notNull().default(4),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
})

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  relationship: text("relationship"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
  strength: preferenceStrengthEnum("strength").notNull().default("soft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const captures = pgTable("captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rawText: text("raw_text").notNull(),
  status: captureStatusEnum("status").notNull().default("pending"),
  extracted: jsonb("extracted").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const lifeNotes = pgTable("life_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rawText: text("raw_text").notNull(),
  contentHash: text("content_hash").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
})

export const memoryChunks = pgTable(
  "memory_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    chunkIndex: integer("chunk_index").notNull().default(0),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("memory_chunks_user_idx").on(t.userId),
    index("memory_chunks_hash_idx").on(t.contentHash),
  ]
)

export const embeddings = pgTable("embeddings", {
  chunkId: uuid("chunk_id")
    .primaryKey()
    .references(() => memoryChunks.id, { onDelete: "cascade" }),
  embedding: embeddingVector("embedding").notNull(),
  dims: integer("dims").notNull().default(384),
})

export const scheduledBlocks = pgTable("scheduled_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: blockKindEnum("kind").notNull(),
  title: text("title").notNull(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  routineId: uuid("routine_id").references(() => routines.id, {
    onDelete: "set null",
  }),
  isProposal: boolean("is_proposal").notNull().default(false),
  accepted: boolean("accepted"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const reminderChains = pgTable("reminder_chains", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  actionLanguage: text("action_language").notNull(),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  persistentNag: boolean("persistent_nag").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const reminderInstances = pgTable("reminder_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  chainId: uuid("chain_id")
    .notNull()
    .references(() => reminderChains.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stage: reminderStageEnum("stage").notNull(),
  status: reminderStatusEnum("status").notNull().default("scheduled"),
  fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const taskPeople = pgTable(
  "task_people",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.personId] })]
)

export const eventPeople = pgTable(
  "event_people",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.personId] })]
)

export const eventPrepTasks = pgTable(
  "event_prep_tasks",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.taskId] })]
)

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  toolCalls: jsonb("tool_calls").$type<unknown>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type TaskRow = typeof tasks.$inferSelect
export type CaptureRow = typeof captures.$inferSelect
