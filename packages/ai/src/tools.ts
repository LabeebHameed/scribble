import type { ToolDef } from "./client"

export const SCRIBBLE_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task in the life model",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
          energyCost: { type: "string", enum: ["low", "medium", "high"] },
          estimatedDuration: { type: "number" },
          deadline: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update an existing task",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          status: {
            type: "string",
            enum: ["open", "in_progress", "done", "dropped"],
          },
          priority: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark a task done",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_energy_note",
      description: "Log current energy/state",
      parameters: {
        type: "object",
        properties: {
          level: { type: "string", enum: ["low", "medium", "high"] },
          notes: { type: "string" },
        },
        required: ["level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description: "Search life memory / RAG for past captures and notes",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_plan",
      description: "Propose a selective auto-placement plan for today",
      parameters: {
        type: "object",
        properties: {
          focus: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_reminder",
      description: "Create a multi-stage reminder chain for a task",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          actionLanguage: { type: "string" },
          persistentNag: { type: "boolean" },
        },
        required: ["taskId", "actionLanguage"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "break_down_task",
      description: "Goblin-style breakdown of a task into subtasks",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          spiciness: { type: "number", minimum: 1, maximum: 5 },
        },
        required: ["taskId"],
      },
    },
  },
]

export function personalitySystemPrompt(tone = "calm") {
  return `You are Scribble, an ADHD life assistant. Tone: ${tone}, clear, structured, supportive, never shaming.
You know the user's life model and memory. Prefer short actionable language.
When useful, call tools to create/update tasks, log energy, search memory, plan, remind, or break down tasks.
Do not invent completions for past events — search memory first.`
}
