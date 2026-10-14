import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import type { ModelCaller } from '../agentRuntime/types'
import { extractDocument, extractOptions } from '../agentChatParsing'
import type { ClaudeCallOptions, ClaudeContentBlock } from '../claude'
import type { MatterRepository } from '../property/matterStore'
import { runPropertyOrchestrator } from '../property/orchestrator'
import { AREA_NOT_LIVE_REPLY, DESCRIBE_PROMPT, ESCALATED_REPLY, PROPERTY_V2_STARTER, UNSUPPORTED_STATE_REPLY } from '../property/starter'
import type { MatterEvent, PropertyMatter } from '../property/types'

function memoryRepo(initial: Partial<PropertyMatter> = {}) {
  const matter: PropertyMatter = { caseId: 'case-1', state: null, lagosArea: null, area: null, facts: {}, status: 'routing', ...initial }
  const log: MatterEvent[] = []
  const repo: MatterRepository = {
    getOrCreateMatter: async () => structuredClone(matter),
    setState: async (_id, state, lagosArea = null) => { matter.state = state; matter.lagosArea = lagosArea },
    setArea: async (_id, area) => { matter.area = area; matter.status = 'active' },
    setStatus: async (_id, status) => { matter.status = status },
    mergeFacts: async (_id, f) => Object.assign(matter.facts, f),
    logEvent: async (_id, kind, payload = {}) => { log.push({ kind, payload, createdAt: '' }) },
    events: async (_id, kind) => log.filter((e) => !kind || e.kind === kind),
  }
  return { repo, matter, log }
}

type Reply = ClaudeContentBlock[]
const text = (t: string): ClaudeContentBlock => ({ type: 'text', text: t })
const use = (name: string, input: Record<string, unknown>, id = name): ClaudeContentBlock => ({ type: 'tool_use', id, name, input })

/** A scripted model: each call gets the next reply. Records every request. */
function model(...replies: Reply[]) {
  const calls: ClaudeCallOptions[] = []
  const call: ModelCaller = async (opts) => {
    calls.push(opts)
    const content = replies[calls.length - 1]
    if (!content) throw new Error(`Unexpected model call #${calls.length} (${opts.route})`)
    return {
      ok: true,
      text: content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n'),
      content,
      stopReason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 },
      costUsd: 0,
      model: opts.model ?? 'test',
    }
  }
  return { call, calls }
}

const starter = { role: 'assistant' as const, content: PROPERTY_V2_STARTER }
const chat = (...turns: string[]) => [starter, ...turns.map((content, i) => ({ role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant', content }))]
const now = new Date('2026-10-14T10:00:00Z')

async function turn(repo: MatterRepository, call: ModelCaller, ...turns: string[]) {
  const result = await runPropertyOrchestrator({ caseId: 'case-1', messages: chat(...turns), now, repo, call })
  if (result.ok === false) throw new Error(result.error)
  return result.response
}

describe('routing without a model call', () => {
  it('a starter button sets the area, then the state is asked', async () => {
    const { repo, matter, log } = memoryRepo()
    const { call, calls } = model()
    const reply = await turn(repo, call, 'Get a tenant out of my property')
    expect(matter).toMatchObject({ area: 'recovery', status: 'active' })
    expect(log).toMatchObject([{ kind: 'routed', payload: { area: 'recovery', via: 'button' } }])
    expect(extractOptions(reply).options).toContain('Lagos')
    expect(calls).toHaveLength(0)
  })

  it('"Something else" asks the client to describe it', async () => {
    const { repo } = memoryRepo()
    expect(await turn(repo, model().call, 'Something else')).toBe(DESCRIBE_PROMPT)
  })

  it('Lagos asks for the area, for the excluded-area exception', async () => {
    const { repo, matter } = memoryRepo({ area: 'recovery', status: 'active' })
    const reply = await turn(repo, model().call, 'Get a tenant out of my property', 'state?', 'Lagos')
    expect(matter.state).toBe('Lagos')
    expect(extractOptions(reply).options).toContain('Ikoyi')
  })

  it('re-asks a state it cannot read', async () => {
    const { repo, matter } = memoryRepo({ area: 'recovery', status: 'active' })
    const reply = await turn(repo, model().call, 'x', 'state?', 'not sure honestly')
    expect(matter.state).toBeNull()
    expect(reply).toMatch(/didn't catch/)
  })

  it('escalates a state the firm does not cover', async () => {
    const { repo, matter, log } = memoryRepo({ area: 'tenancy', status: 'active' })
    expect(await turn(repo, model().call, 'x', 'state?', 'Kano')).toBe(UNSUPPORTED_STATE_REPLY)
    expect(matter.status).toBe('escalated')
    expect(log.at(-1)).toMatchObject({ kind: 'escalated' })
    const other = memoryRepo({ area: 'tenancy', status: 'active' })
    expect(await turn(other.repo, model().call, 'x', 'state?', 'Another state')).toBe(UNSUPPORTED_STATE_REPLY)
  })

  it('escalates an area that is not live yet', async () => {
    const { repo, matter } = memoryRepo()
    expect(await turn(repo, model().call, "A will, or a dead relative's estate")).toBe(AREA_NOT_LIVE_REPLY)
    expect(matter.status).toBe('escalated')
  })

  it('an escalated matter gets the fixed reply, with no model call', async () => {
    const { repo } = memoryRepo({ area: 'recovery', state: 'Oyo', status: 'escalated' })
    expect(await turn(repo, model().call, 'hello?')).toBe(ESCALATED_REPLY)
  })
})

describe('free-text routing', () => {
  it('routes with the stated state and starts the interview in the same turn', async () => {
    const { repo, matter } = memoryRepo()
    const { call, calls } = model(
      [use('route_to', { area: 'recovery', reason: 'Tenant owes rent.', state: 'Oyo' })],
      [text('I am sorry to hear that. How is the rent paid, and how much?')],
    )
    const reply = await turn(repo, call, 'My tenant in Ibadan, Oyo has not paid for a year')
    expect(matter).toMatchObject({ area: 'recovery', state: 'Oyo' })
    expect(calls.map((c) => c.route)).toEqual(['chat.property.router', 'chat.property.recovery'])
    expect(reply).toBe('I am sorry to hear that. How is the rent paid, and how much?')
  })

  it('a squatter with no title is escalated (occupant test)', async () => {
    const { repo, matter } = memoryRepo()
    const { call } = model([use('escalate_to_lawyer', { reason: 'Land grabbers with no title.', message: 'A Pandas LP lawyer will contact you.' })])
    expect(await turn(repo, call, 'Omo onile have taken over my land')).toBe('A Pandas LP lawyer will contact you.')
    expect(matter.status).toBe('escalated')
  })

  it('an unclear request gets one question with buttons', async () => {
    const { repo, matter } = memoryRepo()
    const { call } = model([use('ask_clarifying', { question: 'Is the person living there your tenant?', options: ['Yes, my tenant', 'No'] })])
    const reply = await turn(repo, call, 'someone is in my house')
    expect(extractOptions(reply)).toEqual({ visible: 'Is the person living there your tenant?', options: ['Yes, my tenant', 'No'] })
    expect(matter.area).toBeNull()
  })
})

describe('the area sub-agent', () => {
  const ready = { area: 'recovery' as const, state: 'Lagos', lagosArea: 'ikoyi', status: 'active' as const }

  it('gets the shared and area blocks cached, then the jurisdiction and matter record', async () => {
    const { repo } = memoryRepo({ ...ready, facts: { landlordName: 'Mrs Okafor' } })
    const { call, calls } = model([text('How is the rent paid?')])
    await turn(repo, call, 'Get a tenant out of my property')
    const system = calls[0].system as { text: string; cache?: string }[]
    expect(system.map((b) => b.cache ?? null)).toEqual(['1h', '1h', null, null])
    expect(system[1].text).toMatch(/AREA: RECOVERY OF POSSESSION/)
    expect(system[2].text).toMatch(/Rent Control and Recovery of Residential Premises Law/)
    expect(system[3].text).toMatch(/"landlordName": "Mrs Okafor"/)
    expect(system[3].text).toMatch(/2026/)
    // The conversation sent to the model starts with the client, not the starter menu.
    expect(calls[0].messages[0]).toEqual({ role: 'user', content: 'Get a tenant out of my property' })
  })

  it('sends every area the same tool list, so the cached prefix is shared', async () => {
    const a = model([text('ok')])
    await turn(memoryRepo(ready).repo, a.call, 'hi')
    const b = model([text('ok')])
    await turn(memoryRepo({ ...ready, area: 'searches' }).repo, b.call, 'hi')
    expect(JSON.stringify(a.calls[0].tools)).toBe(JSON.stringify(b.calls[0].tools))
    expect((a.calls[0].system as { text: string }[])[0].text).toBe((b.calls[0].system as { text: string }[])[0].text)
  })

  it('appends an emitted document in the format AgentChat parses', async () => {
    const { repo } = memoryRepo(ready)
    const body = 'Our Ref: {{REF_NUMBER}}\nTAKE NOTICE that you are to quit on or before **1 April 2027**.'
    const { call } = model(
      [text('Here is your Notice to Quit.'), use('emit_document', { documentType: 'notice-to-quit', title: 'Notice to Quit', body })],
      [text('Please check every detail before it is served.')],
    )
    const reply = await turn(repo, call, 'yes, draft it')
    const { visible, doc } = extractDocument(reply)
    expect(doc).toEqual({ title: 'Notice to Quit', body, price: 25_000, priceLabel: 'Tenancy and lease documents' })
    expect(visible).toBe('Here is your Notice to Quit.\n\nPlease check every detail before it is served.')
  })

  it('hands off: the new area answers in the same turn, with the facts and a hand-off note', async () => {
    const { repo, matter, log } = memoryRepo(ready)
    const { call, calls } = model(
      [use('handoff_to', { area: 'tenancy', reason: 'Wants a new tenancy agreement.', facts: { propertyAddress: '4 Bourdillon Road' } })],
      [text('This is now a tenancy matter, and I have what you told me. What rent will the new tenant pay?')],
    )
    const reply = await turn(repo, call, 'Actually I just need a tenancy agreement for my new tenant')
    expect(matter.area).toBe('tenancy')
    expect(log.map((e) => e.kind)).toEqual(['handoff'])
    expect(calls.map((c) => c.route)).toEqual(['chat.property.recovery', 'chat.property.tenancy'])
    const second = calls[1].system as { text: string }[]
    expect(second[3].text).toMatch(/HAND-OFF/)
    expect(second[3].text).toMatch(/4 Bourdillon Road/)
    expect(reply).toMatch(/^This is now a tenancy matter/)
  })

  it('refuses a hand-off the area is not allowed to make, back to the model', async () => {
    const { repo, matter } = memoryRepo(ready)
    const { call, calls } = model(
      [use('handoff_to', { area: 'land-dispute', reason: 'Rival claimant.' })],
      [use('escalate_to_lawyer', { reason: 'Rival claimant; disputes not live yet.' })],
      [text('A Pandas LP lawyer will take this over.')],
    )
    await turn(repo, call, 'The man says he bought the land from my uncle')
    const refused = (calls[1].messages.at(-1)!.content as { is_error?: boolean; content: string }[])[0]
    expect(refused).toMatchObject({ is_error: true })
    expect(refused.content).toMatch(/not available yet/)
    expect(matter).toMatchObject({ area: 'recovery', status: 'escalated' })
  })

  it('reports a model failure as an error, not a reply', async () => {
    const { repo } = memoryRepo(ready)
    const call: ModelCaller = async () => ({ ok: false, status: 502, error: 'Anthropic API returned 529.' })
    const result = await runPropertyOrchestrator({ caseId: 'case-1', messages: chat('hi'), now, repo, call })
    expect(result).toMatchObject({ ok: false, status: 502 })
  })
})
