// The tool loop: call the model, run every tool it asks for, send the results back, and repeat
// until it answers without asking for a tool, a tool ends the turn, or maxSteps is reached.
// Every model call goes through callClaude, so caching and the ai_usage cost record work
// exactly as they do for a plain chat turn.
//
// Tools are passed in the same order on every call: they sit before the system prompt in the
// cache prefix, so a changed list would lose the cached system blocks.

import { callClaude, type ClaudeContentBlock, type ClaudeMessage } from '../claude'
import type { AgentTool, RunAgentOptions, RunAgentResult, StopSignal, ToolOutcome } from './types'

type ToolUse = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

function isToolUse(block: ClaudeContentBlock): block is ToolUse {
  return block.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string'
}

async function runTool<Ctx>(tool: AgentTool<Ctx> | undefined, use: ToolUse, ctx: Ctx): Promise<ToolOutcome> {
  if (!tool) return { ok: false, error: `There is no tool called ${use.name}.` }
  try {
    return await tool.handler(use.input ?? {}, ctx)
  } catch (err) {
    // A RangeError from a calculator is a message for the model (bad input it can fix).
    // Anything else is logged and reported without internals.
    if (err instanceof RangeError) return { ok: false, error: err.message }
    console.error(`Tool ${use.name} failed:`, err)
    return { ok: false, error: 'The tool failed. Do not retry it; tell the client a lawyer will follow up.' }
  }
}

export async function runAgent<Ctx>(opts: RunAgentOptions<Ctx>): Promise<RunAgentResult> {
  const call = opts.call ?? callClaude
  const toolsByName = new Map(opts.tools.map((t) => [t.definition.name, t]))
  const definitions = opts.tools.map((t) => t.definition)

  const newMessages: ClaudeMessage[] = []
  const said: string[] = []
  let costUsd = 0

  for (let step = 1; step <= opts.maxSteps; step++) {
    const result = await call({
      route: opts.route,
      system: opts.system,
      messages: [...opts.messages, ...newMessages],
      tools: definitions.length ? definitions : undefined,
      maxTokens: opts.maxTokens,
      model: opts.model,
      cacheConversation: opts.cacheConversation,
      caseId: opts.caseId ?? null,
    })
    if (result.ok === false) {
      return { ok: false, kind: 'model', error: result.error, newMessages, steps: step, costUsd, notConfigured: result.notConfigured }
    }
    costUsd += result.costUsd
    newMessages.push({ role: 'assistant', content: result.content })
    if (result.text.trim()) said.push(result.text.trim())

    const uses = result.content.filter(isToolUse)
    if (result.stopReason !== 'tool_use' || uses.length === 0) {
      return { ok: true, text: said.join('\n\n'), newMessages, stop: null, steps: step, costUsd }
    }

    // Every tool_use gets its tool_result, all in one user message, even when one of them ends
    // the turn: the conversation must stay valid to continue from.
    let stop: StopSignal | null = null
    const results: unknown[] = []
    for (const use of uses) {
      const outcome = await runTool(toolsByName.get(use.name), use, opts.ctx)
      if (outcome.ok === true) {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(outcome.result ?? null) })
        stop ??= outcome.stop ?? null
      } else {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: outcome.error, is_error: true })
      }
    }
    newMessages.push({ role: 'user', content: results })

    if (stop) return { ok: true, text: said.join('\n\n'), newMessages, stop, steps: step, costUsd }
  }

  return {
    ok: false,
    kind: 'max_steps',
    error: `The agent did not finish within ${opts.maxSteps} steps.`,
    newMessages,
    steps: opts.maxSteps,
    costUsd,
  }
}
