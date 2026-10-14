import { describe, expect, it } from 'vitest'
import { runAgent } from '../agentRuntime/runAgent'
import type { AgentTool, ModelCaller } from '../agentRuntime/types'
import type { ClaudeCallOptions, ClaudeContentBlock } from '../claude'

/** A stand-in model: returns the scripted replies in order and records every request. */
function scriptedModel(replies: { content: ClaudeContentBlock[]; stopReason?: string }[]) {
  const calls: ClaudeCallOptions[] = []
  const call: ModelCaller = async (opts) => {
    calls.push(structuredClone(opts))
    const reply = replies[calls.length - 1]
    if (!reply) throw new Error('The model was called more times than scripted.')
    const text = reply.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n')
    const stopReason = reply.stopReason ?? (reply.content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn')
    return {
      ok: true,
      text,
      content: reply.content,
      stopReason,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 },
      costUsd: 0.01,
      model: 'test',
    }
  }
  return { call, calls }
}

const text = (t: string): ClaudeContentBlock => ({ type: 'text', text: t })
const use = (id: string, name: string, input: Record<string, unknown> = {}): ClaudeContentBlock => ({ type: 'tool_use', id, name, input })

type Ctx = { log: string[] }
const echo: AgentTool<Ctx> = {
  definition: { name: 'echo', description: 'Echoes.', input_schema: { type: 'object' } },
  handler: (input, ctx) => {
    ctx.log.push(`echo:${String(input.v)}`)
    return { ok: true, result: { v: input.v } }
  },
}
const broken: AgentTool<Ctx> = {
  definition: { name: 'broken', description: 'Fails.', input_schema: { type: 'object' } },
  handler: () => {
    throw new RangeError('days must be a whole number.')
  },
}
const handoff: AgentTool<Ctx> = {
  definition: { name: 'handoff', description: 'Hands off.', input_schema: { type: 'object' } },
  handler: () => ({ ok: true, result: { done: true }, stop: { kind: 'handoff', data: { to: 'tenancy' } } }),
}

const base = (call: ModelCaller, tools: AgentTool<Ctx>[] = [echo, broken, handoff]) => ({
  route: 'chat.test',
  system: [{ text: 'SYSTEM', cache: '1h' as const }],
  tools,
  messages: [{ role: 'user' as const, content: 'hello' }],
  ctx: { log: [] as string[] },
  maxSteps: 4,
  maxTokens: 1000,
  call,
})

describe('runAgent', () => {
  it('returns a plain answer in one step', async () => {
    const { call, calls } = scriptedModel([{ content: [text('Hello there.')] }])
    const result = await runAgent(base(call))
    expect(result).toMatchObject({ ok: true, text: 'Hello there.', stop: null, steps: 1 })
    expect(calls[0].tools?.map((t) => t.name)).toEqual(['echo', 'broken', 'handoff'])
  })

  it('runs tools over several steps and sends every result back', async () => {
    const { call, calls } = scriptedModel([
      { content: [text('Checking.'), use('a', 'echo', { v: 1 }), use('b', 'echo', { v: 2 })] },
      { content: [use('c', 'echo', { v: 3 })] },
      { content: [text('All done.')] },
    ])
    const opts = base(call)
    const result = await runAgent(opts)
    expect(result).toMatchObject({ ok: true, text: 'Checking.\n\nAll done.', steps: 3 })
    expect(opts.ctx.log).toEqual(['echo:1', 'echo:2', 'echo:3'])
    // Both results of the first round go back together, in one user message.
    expect(calls[1].messages.at(-1)).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'a', content: '{"v":1}' },
        { type: 'tool_result', tool_use_id: 'b', content: '{"v":2}' },
      ],
    })
    // The tool list is identical on every call, so the cache prefix holds.
    expect(calls.map((c) => JSON.stringify(c.tools))).toEqual(Array(3).fill(JSON.stringify(calls[0].tools)))
    expect(result.ok && result.costUsd).toBeCloseTo(0.03)
  })

  it('returns a failing handler and an unknown tool to the model as errors', async () => {
    const { call, calls } = scriptedModel([
      { content: [use('a', 'broken'), use('b', 'nope')] },
      { content: [text('Sorry, let me ask again.')] },
    ])
    const result = await runAgent(base(call))
    expect(result.ok).toBe(true)
    expect(calls[1].messages.at(-1)).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'a', content: 'days must be a whole number.', is_error: true },
        { type: 'tool_result', tool_use_id: 'b', content: 'There is no tool called nope.', is_error: true },
      ],
    })
  })

  it('hides the details of an unexpected handler failure', async () => {
    const crash: AgentTool<Ctx> = { definition: { name: 'crash', description: '', input_schema: {} }, handler: () => { throw new Error('db password wrong') } }
    const { call, calls } = scriptedModel([{ content: [use('a', 'crash')] }, { content: [text('ok')] }])
    await runAgent(base(call, [crash]))
    const result = (calls[1].messages.at(-1)!.content as { content: string }[])[0]
    expect(result.content).not.toContain('password')
  })

  it('stops early when a tool says so, after answering every tool call', async () => {
    const { call, calls } = scriptedModel([{ content: [text('Passing this on.'), use('a', 'echo', { v: 1 }), use('b', 'handoff')] }])
    const result = await runAgent(base(call))
    expect(calls).toHaveLength(1)
    expect(result).toMatchObject({ ok: true, text: 'Passing this on.', stop: { kind: 'handoff', data: { to: 'tenancy' } } })
    expect(result.newMessages.at(-1)!.content).toHaveLength(2)
  })

  it('gives up after maxSteps', async () => {
    const loop = Array(4).fill({ content: [use('a', 'echo', { v: 0 })] })
    const { call } = scriptedModel(loop)
    const result = await runAgent({ ...base(call), maxSteps: 4 })
    expect(result).toMatchObject({ ok: false, kind: 'max_steps', steps: 4 })
  })

  it('reports a model failure', async () => {
    const call: ModelCaller = async () => ({ ok: false, status: 502, error: 'Anthropic API returned 529.' })
    const result = await runAgent(base(call))
    expect(result).toMatchObject({ ok: false, kind: 'model', error: 'Anthropic API returned 529.' })
  })
})
