// LOCAL TESTING ONLY. A ModelCaller that sends the agent runtime's Claude-shaped requests to
// Groq's OpenAI-compatible chat API and turns the answer back into Claude-shaped content
// blocks, so lib/property/orchestrator.ts can be driven end to end without an Anthropic key.
// Used by scripts/property-agent-chat.ts. Never imported by the app.
//
// Groq runs different models (Llama, etc.): a run here checks the plumbing (routing, tools,
// saved state, documents, prices), not how Claude itself will behave or what it costs.

import type { ModelCaller } from '../agentRuntime/types'
import type { ClaudeCallOptions, ClaudeContentBlock, ClaudeResult } from '../claude'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** The model for a call: the router's cheap model maps to GROQ_ROUTER_MODEL, everything else to GROQ_MODEL. */
export function groqModelFor(model: string | undefined, env: Record<string, string | undefined> = process.env): string {
  const main = env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  if (model?.includes('haiku')) return env.GROQ_ROUTER_MODEL || main
  return main
}

type OpenAIMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string }

type Block = { type: string; [key: string]: unknown }

function textOf(blocks: Block[]): string {
  return blocks.filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('\n')
}

/** Claude request → OpenAI chat request body. Pure, so it is unit-tested. */
export function toOpenAIRequest(opts: ClaudeCallOptions, model: string) {
  const system = typeof opts.system === 'string' ? opts.system : opts.system.map((b) => b.text).filter((t) => t.trim()).join('\n\n')
  const messages: OpenAIMessage[] = system ? [{ role: 'system', content: system }] : []

  for (const m of opts.messages) {
    if (typeof m.content === 'string') {
      messages.push({ role: m.role, content: m.content })
      continue
    }
    const blocks = m.content as Block[]
    if (m.role === 'assistant') {
      const calls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({
        id: String(b.id),
        type: 'function' as const,
        function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) },
      }))
      messages.push({ role: 'assistant', content: textOf(blocks) || null, ...(calls.length ? { tool_calls: calls } : {}) })
    } else {
      // A user turn of tool results becomes one tool message per result.
      for (const b of blocks) {
        if (b.type === 'tool_result') {
          const content = typeof b.content === 'string' ? b.content : JSON.stringify(b.content)
          messages.push({ role: 'tool', tool_call_id: String(b.tool_use_id), content: b.is_error ? `ERROR: ${content}` : content })
        }
      }
      const text = textOf(blocks)
      if (text) messages.push({ role: 'user', content: text })
    }
  }

  return {
    model,
    max_tokens: opts.maxTokens,
    messages,
    ...(opts.tools?.length
      ? {
          tools: opts.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
          tool_choice: opts.toolChoice?.type === 'none' ? 'none' : 'auto',
        }
      : {}),
  }
}

type OpenAIResponse = {
  model?: string
  choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

/** OpenAI chat response → the runtime's ClaudeResult. Pure, so it is unit-tested. */
export function fromOpenAIResponse(data: OpenAIResponse, requestedModel: string): ClaudeResult {
  const choice = data.choices?.[0]
  const message = choice?.message ?? {}
  const content: ClaudeContentBlock[] = []
  if (message.content && message.content.trim()) content.push({ type: 'text', text: message.content })
  for (const call of message.tool_calls ?? []) {
    let input: Record<string, unknown>
    try {
      const parsed = JSON.parse(call.function.arguments || '{}')
      input = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      // Unreadable arguments: the handler will report the missing fields back to the model.
      input = {}
    }
    content.push({ type: 'tool_use', id: call.id, name: call.function.name, input })
  }
  const finish = choice?.finish_reason
  const stopReason = finish === 'tool_calls' || (message.tool_calls?.length ?? 0) > 0 ? 'tool_use' : finish === 'length' ? 'max_tokens' : 'end_turn'
  return {
    ok: true,
    text: content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n'),
    content,
    stopReason,
    usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 },
    costUsd: 0,
    model: data.model ?? requestedModel,
  }
}

export interface GroqCallLog {
  route: string
  model: string
  ms: number
  inputTokens: number
  outputTokens: number
  toolCalls: string[]
}

/** A ModelCaller backed by Groq. Waits and retries on rate limits (the free tier has low per-minute limits). */
export function createGroqCaller(opts: { apiKey: string; onCall?: (log: GroqCallLog) => void; maxRetries?: number }): ModelCaller {
  const maxRetries = opts.maxRetries ?? 4
  return async (req) => {
    const model = groqModelFor(req.model)
    const body = JSON.stringify(toOpenAIRequest(req, model))
    for (let attempt = 0; ; attempt++) {
      const started = Date.now()
      let res: Response
      try {
        res = await fetch(GROQ_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` }, body })
      } catch (err) {
        return { ok: false, status: 500, error: `Network error calling Groq: ${(err as Error).message}` }
      }
      if (res.status === 429 && attempt < maxRetries) {
        const wait = Math.min(Number(res.headers.get('retry-after')) || 5 * (attempt + 1), 60)
        console.warn(`  [groq] rate limited; waiting ${wait}s`)
        await new Promise((r) => setTimeout(r, wait * 1000))
        continue
      }
      if (!res.ok) {
        const text = await res.text()
        console.warn(`  [groq] ${res.status}: ${text.slice(0, 300)}`)
        return { ok: false, status: res.status === 429 ? 429 : 502, error: `Groq returned ${res.status}: ${text.slice(0, 500)}` }
      }
      const result = fromOpenAIResponse((await res.json()) as OpenAIResponse, model)
      if (result.ok === true) {
        opts.onCall?.({
          route: req.route,
          model: result.model,
          ms: Date.now() - started,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          toolCalls: result.content.filter((b) => b.type === 'tool_use').map((b) => String((b as { name: string }).name)),
        })
      }
      return result
    }
  }
}
