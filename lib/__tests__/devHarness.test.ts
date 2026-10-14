import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { fromOpenAIResponse, groqModelFor, nullableOptionals, toOpenAIRequest } from '../dev/groqCaller'
import { SqliteMatterRepo } from '../dev/sqliteMatterRepo'
import { runPropertyOrchestrator } from '../property/orchestrator'
import { PROPERTY_V2_STARTER } from '../property/starter'

describe('groqCaller translation', () => {
  it('turns system blocks, tool calls and tool results into OpenAI chat messages', () => {
    const body = toOpenAIRequest(
      {
        route: 'x',
        system: [{ text: 'SHARED', cache: '1h' }, { text: 'AREA' }],
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: [{ type: 'text', text: 'Checking.' }, { type: 'tool_use', id: 't1', name: 'get_fee', input: { documentType: 'will' } }] },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"amount":null}' }, { type: 'tool_result', tool_use_id: 't2', content: 'bad', is_error: true }] },
        ],
        maxTokens: 100,
        tools: [{ name: 'get_fee', description: 'Fee.', input_schema: { type: 'object' } }],
      },
      'llama',
    )
    expect(body.messages).toEqual([
      { role: 'system', content: 'SHARED\n\nAREA' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Checking.', tool_calls: [{ id: 't1', type: 'function', function: { name: 'get_fee', arguments: '{"documentType":"will"}' } }] },
      { role: 'tool', tool_call_id: 't1', content: '{"amount":null}' },
      { role: 'tool', tool_call_id: 't2', content: 'ERROR: bad' },
    ])
    expect(body.tools).toEqual([{ type: 'function', function: { name: 'get_fee', description: 'Fee.', parameters: { type: 'object' } } }])
    expect(body.tool_choice).toBe('auto')
  })

  it('turns an OpenAI answer back into text and tool_use blocks', () => {
    const result = fromOpenAIResponse({
      choices: [{ finish_reason: 'tool_calls', message: { content: 'One moment.', tool_calls: [{ id: 'c1', function: { name: 'record_facts', arguments: '{"facts":{"rent":5}}' } }, { id: 'c2', function: { name: 'x', arguments: 'not json' } }] } }],
      usage: { prompt_tokens: 10, completion_tokens: 3 },
    }, 'llama')
    expect(result).toMatchObject({
      ok: true,
      text: 'One moment.',
      stopReason: 'tool_use',
      content: [
        { type: 'text', text: 'One moment.' },
        { type: 'tool_use', id: 'c1', name: 'record_facts', input: { facts: { rent: 5 } } },
        { type: 'tool_use', id: 'c2', name: 'x', input: {} },
      ],
      usage: { inputTokens: 10, outputTokens: 3 },
    })
  })

  it('sends optional tool fields as nullable, since Groq models send null for unused ones', () => {
    expect(nullableOptionals({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'string', enum: ['x'] }, c: { type: 'number' } }, required: ['a'] })).toEqual({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: ['string', 'null'], enum: ['x', null] }, c: { type: ['number', 'null'] } },
      required: ['a'],
    })
  })

  it('maps the router model and the main model', () => {
    expect(groqModelFor('claude-haiku-4-5', { GROQ_MODEL: 'big', GROQ_ROUTER_MODEL: 'small' })).toBe('small')
    expect(groqModelFor(undefined, { GROQ_MODEL: 'big', GROQ_ROUTER_MODEL: 'small' })).toBe('big')
    expect(groqModelFor('claude-haiku-4-5', {})).toBe('openai/gpt-oss-20b')
    expect(groqModelFor(undefined, {})).toBe('openai/gpt-oss-120b')
  })
})

describe('SqliteMatterRepo', () => {
  it('stores a matter the way the Postgres store does', async () => {
    const repo = new SqliteMatterRepo()
    const caseId = repo.createCase()
    expect(await repo.getOrCreateMatter(caseId)).toEqual({ caseId, state: null, lagosArea: null, area: null, facts: {}, status: 'routing' })
    await repo.setArea(caseId, 'recovery')
    await repo.setState(caseId, 'Lagos', 'ikoyi')
    await repo.mergeFacts(caseId, { a: 1, nested: { x: 1 } })
    expect(await repo.mergeFacts(caseId, { nested: { y: 2 } })).toEqual({ a: 1, nested: { y: 2 } }) // top-level replace, like jsonb ||
    await repo.logEvent(caseId, 'routed', { area: 'recovery' })
    expect(await repo.getOrCreateMatter(caseId)).toMatchObject({ area: 'recovery', state: 'Lagos', lagosArea: 'ikoyi', status: 'active' })
    expect(await repo.events(caseId, 'routed')).toMatchObject([{ kind: 'routed', payload: { area: 'recovery' } }])
    await expect(repo.setArea(caseId, 'probate' as never)).rejects.toThrow()
    await expect(repo.logEvent(caseId, 'nonsense' as never)).rejects.toThrow()
    repo.close()
  })

  it('runs the orchestrator end to end with a stand-in model', async () => {
    const repo = new SqliteMatterRepo()
    const caseId = repo.createCase()
    const reply = await runPropertyOrchestrator({
      caseId,
      messages: [{ role: 'assistant', content: PROPERTY_V2_STARTER }, { role: 'user', content: 'Search a property before I buy it' }],
      now: new Date(),
      repo,
      call: async () => { throw new Error('no model call expected') },
    })
    expect(reply).toMatchObject({ ok: true })
    expect(await repo.getOrCreateMatter(caseId)).toMatchObject({ area: 'searches', status: 'active' })
    repo.close()
  })
})
