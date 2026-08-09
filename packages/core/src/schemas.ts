import { z } from "zod"

export const taskStatusSchema = z.enum(["open", "in_progress", "done", "dropped"])
export const prioritySchema = z.enum(["critical", "high", "medium", "low"])
export const energyLevelSchema = z.enum(["low", "medium", "high"])
export const flexibilitySchema = z.enum(["rigid", "soft", "highly_flexible"])
export const preferenceStrengthSchema = z.enum(["hard", "soft"])
export const captureStatusSchema = z.enum([
  "pending",
  "confirmed",
  "dismissed",
])
export const reminderStageSchema = z.enum([
  "day_before",
  "prep",
  "action",
  "final",
  "nag",
])
export const reminderStatusSchema = z.enum([
  "scheduled",
  "sent",
  "acknowledged",
  "snoozed",
  "completed",
  "cancelled",
])
export const blockKindSchema = z.enum([
  "task",
  "event",
  "routine",
  "break",
  "buffer",
])

export const taskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: taskStatusSchema,
  priority: prioritySchema,
  energyCost: energyLevelSchema.nullable().optional(),
  estimatedDuration: z.number().int().positive().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  preferredWindows: z
    .array(
      z.object({
        label: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
    )
    .default([]),
  project: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  sourceCaptureId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
})

export const eventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  location: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isFixed: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const routineSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  preferredWindows: z.array(z.record(z.string())).default([]),
  minDuration: z.number().int().positive().nullable().optional(),
  idealDuration: z.number().int().positive().nullable().optional(),
  maxDuration: z.number().int().positive().nullable().optional(),
  priority: prioritySchema.default("medium"),
  recurrenceRule: z.string().nullable().optional(),
  energyProfile: energyLevelSchema.nullable().optional(),
  flexibility: flexibilitySchema.default("soft"),
  checklist: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const energyNoteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  level: energyLevelSchema,
  notes: z.string().nullable().optional(),
  affectsHours: z.number().int().positive().default(4),
  timestamp: z.string().datetime(),
})

export const personSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  relationship: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const preferenceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string().min(1),
  value: z.record(z.unknown()),
  strength: preferenceStrengthSchema.default("soft"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const lifeNoteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  rawText: z.string().min(1),
  contentHash: z.string(),
  timestamp: z.string().datetime(),
})

export const captureSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  rawText: z.string().min(1),
  status: captureStatusSchema,
  extracted: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const scheduledBlockSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  kind: blockKindSchema,
  title: z.string(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  taskId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  routineId: z.string().uuid().nullable().optional(),
  isProposal: z.boolean().default(false),
  accepted: z.boolean().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const extractedCandidateSchema = z.object({
  type: z.enum([
    "task",
    "event",
    "routine",
    "energy",
    "person",
    "preference",
    "note",
  ]),
  title: z.string().optional(),
  data: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(0.7),
})

export const extractionResultSchema = z.object({
  candidates: z.array(extractedCandidateSchema),
  summary: z.string().optional(),
})

export type TaskStatus = z.infer<typeof taskStatusSchema>
export type Priority = z.infer<typeof prioritySchema>
export type EnergyLevel = z.infer<typeof energyLevelSchema>
export type Task = z.infer<typeof taskSchema>
export type Event = z.infer<typeof eventSchema>
export type Routine = z.infer<typeof routineSchema>
export type EnergyNote = z.infer<typeof energyNoteSchema>
export type Person = z.infer<typeof personSchema>
export type Preference = z.infer<typeof preferenceSchema>
export type LifeNote = z.infer<typeof lifeNoteSchema>
export type Capture = z.infer<typeof captureSchema>
export type ScheduledBlock = z.infer<typeof scheduledBlockSchema>
export type ExtractedCandidate = z.infer<typeof extractedCandidateSchema>
export type ExtractionResult = z.infer<typeof extractionResultSchema>
