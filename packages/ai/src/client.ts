export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  name?: string
  tool_call_id?: string
}

export type ToolDef = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export async function chatCompletion(opts: {
  messages: ChatMessage[]
  tools?: ToolDef[]
  temperature?: number
  model?: string
}) {
  const apiKey = process.env.OPENAI_API_KEY
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  const model = opts.model || process.env.OPENAI_MODEL || "openai/gpt-4o-mini"

  if (!apiKey) {
    return {
      offline: true as const,
      content: null as string | null,
      toolCalls: [] as Array<{ id: string; name: string; arguments: string }>,
    }
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Scribble",
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      tools: opts.tools,
      temperature: opts.temperature ?? 0.3,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM error ${res.status}: ${text}`)
  }

  const json = (await res.json()) as {
    choices: {
      message: {
        content?: string | null
        tool_calls?: Array<{
          id: string
          function: { name: string; arguments: string }
        }>
      }
    }[]
  }

  const msg = json.choices[0]?.message
  return {
    offline: false as const,
    content: msg?.content ?? null,
    toolCalls:
      msg?.tool_calls?.map((t) => ({
        id: t.id,
        name: t.function.name,
        arguments: t.function.arguments,
      })) ?? [],
  }
}
