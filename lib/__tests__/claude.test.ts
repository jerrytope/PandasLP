import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: { from: () => ({ insert: async () => ({ error: null }) }) } }))

import { buildClaudeRequest, callClaude } from '../claude'
import { costUsd, normaliseUsage, uncachedCostUsd } from '../aiPricing'

describe('buildClaudeRequest', () => {
  it('puts a 1-hour breakpoint on the stable system block and keeps volatile text after it', () => {
    const body = buildClaudeRequest({
      route: 'chat.test',
      system: [
        { text: 'STABLE AGENT PROMPT', cache: '1h' },
        { text: 'CURRENT DATE: today' },
      ],
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 100,
      cacheConversation: true,
    })
    expect(body.system).toEqual([
      { type: 'text', text: 'STABLE AGENT PROMPT', cache_control: { type: 'ephemeral', ttl: '1h' } },
      { type: 'text', text: 'CURRENT DATE: today' },
    ])
    expect(body.cache_control).toEqual({ type: 'ephemeral' })
    expect(body.model).toBe('claude-sonnet-4-6')
  })

  it('sends a plain string system prompt uncached, with no conversation caching', () => {
    const body = buildClaudeRequest({ route: 'x', system: 'PROMPT', messages: [], maxTokens: 10 })
    expect(body.system).toEqual([{ type: 'text', text: 'PROMPT' }])
    expect('cache_control' in body).toBe(false)
  })
})

describe('buildClaudeRequest with tools', () => {
  const tool = { name: 'get_fee', description: 'Fee for a document.', input_schema: { type: 'object', properties: {} } }

  it('sends tools (and tool_choice) without changing the caching layout', () => {
    const body = buildClaudeRequest({
      route: 'x',
      system: [{ text: 'STABLE', cache: '1h' }, { text: 'DATE' }],
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 100,
      cacheConversation: true,
      tools: [tool],
      toolChoice: { type: 'auto' },
    })
    expect(body.tools).toEqual([tool])
    expect(body.tool_choice).toEqual({ type: 'auto' })
    expect(body.system).toEqual([
      { type: 'text', text: 'STABLE', cache_control: { type: 'ephemeral', ttl: '1h' } },
      { type: 'text', text: 'DATE' },
    ])
    expect(body.cache_control).toEqual({ type: 'ephemeral' })
  })

  it('leaves tools and tool_choice out when there are no tools', () => {
    const body = buildClaudeRequest({ route: 'x', system: 'P', messages: [], maxTokens: 10, tools: [], toolChoice: { type: 'auto' } })
    expect('tools' in body).toBe(false)
    expect('tool_choice' in body).toBe(false)
  })
})

describe('callClaude', () => {
  it('returns the raw content blocks as well as the joined text', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const content = [
      { type: 'text', text: 'Let me check the fee.' },
      { type: 'tool_use', id: 'tu_1', name: 'get_fee', input: { documentType: 'deed-of-gift' } },
    ]
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content, model: 'claude-sonnet-4-6', stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 } })),
    )
    try {
      const result = await callClaude({ route: 'x', system: 'P', messages: [{ role: 'user', content: 'hi' }], maxTokens: 10 })
      expect(result).toMatchObject({ ok: true, text: 'Let me check the fee.', content, stopReason: 'tool_use' })
    } finally {
      fetchMock.mockRestore()
      delete process.env.ANTHROPIC_API_KEY
    }
  })
})

describe('aiPricing', () => {
  it('prices a cached turn at a fraction of an uncached one', () => {
    const usage = normaliseUsage({
      input_tokens: 200,
      output_tokens: 300,
      cache_read_input_tokens: 9_000,
      cache_creation_input_tokens: 500,
      cache_creation: { ephemeral_5m_input_tokens: 500, ephemeral_1h_input_tokens: 0 },
    })
    expect(costUsd('claude-sonnet-4-6', usage)).toBeCloseTo((200 * 3 + 9000 * 0.3 + 500 * 3.75 + 300 * 15) / 1e6, 6)
    expect(uncachedCostUsd('claude-sonnet-4-6', usage)).toBeCloseTo((9700 * 3 + 300 * 15) / 1e6, 6)
    expect(costUsd('claude-sonnet-4-6', usage)).toBeLessThan(uncachedCostUsd('claude-sonnet-4-6', usage))
  })

  it('attributes writes without a TTL breakdown to the TTL that was requested', () => {
    expect(normaliseUsage({ cache_creation_input_tokens: 1000 }, true).cacheWrite1hTokens).toBe(1000)
    expect(normaliseUsage({ cache_creation_input_tokens: 1000 }, false).cacheWrite5mTokens).toBe(1000)
  })

  it('never prices an unknown model as free', () => {
    const u = normaliseUsage({ input_tokens: 1_000_000, output_tokens: 0 })
    expect(costUsd('some-future-model', u)).toBe(3)
  })
})
