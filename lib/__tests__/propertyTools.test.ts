import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import { extractDocument } from '../agentChatParsing'
import type { MatterStore } from '../property/matterStore'
import { SHARED_PROPERTY_TOOLS, type PropertyToolContext } from '../property/tools'
import { findPlaceholders } from '../property/tools/emitDocument'
import type { MatterEvent, PropertyArea } from '../property/types'

/** An in-memory MatterStore, so the tools are tested without a database. */
function memoryStore() {
  const facts: Record<string, unknown> = {}
  const log: MatterEvent[] = []
  const state = { area: null as PropertyArea | null, status: 'routing' as string }
  const store: MatterStore = {
    mergeFacts: async (_id, f) => Object.assign(facts, f),
    setArea: async (_id, area) => { state.area = area; state.status = 'active' },
    setStatus: async (_id, status) => { state.status = status },
    logEvent: async (_id, kind, payload = {}) => { log.push({ kind, payload, createdAt: new Date().toISOString() }) },
    events: async (_id, kind) => log.filter((e) => !kind || e.kind === kind),
  }
  return { store, facts, log, state }
}

function setup(area: PropertyArea | null = 'recovery') {
  const mem = memoryStore()
  const ctx: PropertyToolContext = { caseId: 'case-1', area, store: mem.store, emitted: [] }
  const run = async (name: string, input: Record<string, unknown>) => {
    const tool = SHARED_PROPERTY_TOOLS.find((t) => t.definition.name === name)!
    try {
      return await tool.handler(input, ctx)
    } catch (err) {
      return { ok: false as const, error: (err as Error).message }
    }
  }
  return { ...mem, ctx, run }
}

const NTQ_BODY = 'Our Ref: {{REF_NUMBER}}\nTO: Mr Ade Bello\nTAKE NOTICE that you are to quit on or before **1 April 2026**.'

describe('shared property tools', () => {
  it('have unique names and an object schema each', () => {
    const names = SHARED_PROPERTY_TOOLS.map((t) => t.definition.name)
    expect(new Set(names).size).toBe(names.length)
    for (const t of SHARED_PROPERTY_TOOLS) expect(t.definition.input_schema.type).toBe('object')
  })

  it('calc tools return the calculator results and turn bad input into an error for the model', async () => {
    const { run } = setup()
    expect(await run('calc_mesne_profits', { annualRent: 1_200_000, days: 90 })).toMatchObject({ ok: true, result: { amount: 295_890.41 } })
    expect(await run('calc_notice_to_quit', { tenancyType: 'monthly', state: 'Oyo', receivedOn: '2026-03-01' })).toMatchObject({ ok: true, result: { needed: true, quitDate: '2026-04-01' } })
    expect(await run('calc_notice_to_quit', { tenancyType: 'monthly', state: 'Oyo', receivedOn: '2026-03-01', agreementPeriodCount: 2 })).toMatchObject({ ok: false })
    expect(await run('calc_arrears', { rent: 150_000, frequency: 'fortnightly', from: '2026-01-01', to: '2026-02-01' })).toMatchObject({ ok: false })
  })

  it('get_fee returns prices from code, and no price for fees not yet set', async () => {
    const { run } = setup()
    expect(await run('get_fee', { documentType: 'notice-to-quit' })).toMatchObject({ ok: true, result: { kind: 'flat', amount: 25_000 } })
    expect(await run('get_fee', { documentType: 'will' })).toMatchObject({ ok: true, result: { kind: 'lawyer-confirms', amount: null } })
    expect(await run('get_fee', { documentType: 'deed-of-assignment' })).toMatchObject({ ok: true, result: { kind: 'transfer', rate: 0.025 } })
    expect(await run('get_fee', { documentType: 'anything' })).toMatchObject({ ok: false })
  })

  it('record_facts merges facts into the matter', async () => {
    const { run, facts } = setup()
    await run('record_facts', { facts: { landlordName: 'Mrs Okafor' } })
    expect(await run('record_facts', { facts: { rent: 1_200_000 } })).toMatchObject({ ok: true, result: { factCount: 2 } })
    expect(facts).toEqual({ landlordName: 'Mrs Okafor', rent: 1_200_000 })
    expect(await run('record_facts', { facts: ['not', 'an', 'object'] })).toMatchObject({ ok: false })
  })

  it('handoff_to saves facts, switches the area, logs it and ends the turn', async () => {
    const { run, ctx, facts, log, state } = setup('recovery')
    const out = await run('handoff_to', { area: 'tenancy', reason: 'The landlord wants a new tenancy agreement.', facts: { propertyAddress: '4 Allen Avenue' } })
    expect(out).toMatchObject({ ok: true, stop: { kind: 'handoff', data: { from: 'recovery', to: 'tenancy' } } })
    expect(ctx.area).toBe('tenancy')
    expect(state.area).toBe('tenancy')
    expect(facts).toEqual({ propertyAddress: '4 Allen Avenue' })
    expect(log).toMatchObject([{ kind: 'handoff', payload: { from: 'recovery', to: 'tenancy' } }])
    expect(await run('handoff_to', { area: 'tenancy', reason: 'again' })).toMatchObject({ ok: false })
    expect(await run('handoff_to', { area: 'probate', reason: 'x' })).toMatchObject({ ok: false })
  })

  it('escalate_to_lawyer marks the matter escalated and ends the turn', async () => {
    const { run, log, state } = setup('recovery')
    expect(await run('escalate_to_lawyer', { reason: 'The tenant now claims to own the property.' })).toMatchObject({ ok: true, stop: { kind: 'escalate' } })
    expect(state.status).toBe('escalated')
    expect(log[0]).toMatchObject({ kind: 'escalated', payload: { area: 'recovery' } })
  })
})

describe('emit_document', () => {
  it('renders the <<<DOCUMENT>>> block AgentChat parses, with the price from code', async () => {
    const { run, ctx, log } = setup('recovery')
    const out = await run('emit_document', { documentType: 'notice-to-quit', title: 'Notice to Quit', body: NTQ_BODY })
    expect(out).toMatchObject({ ok: true, result: { price: 25_000 } })
    expect(ctx.emitted).toHaveLength(1)
    expect(extractDocument(`Here it is.\n\n${ctx.emitted[0].block}`).doc).toEqual({
      title: 'Notice to Quit',
      body: NTQ_BODY,
      price: 25_000,
      priceLabel: 'Tenancy and lease documents',
    })
    expect(log).toMatchObject([{ kind: 'document_emitted', payload: { documentType: 'notice-to-quit', price: 25_000 } }])
  })

  it('a second emit in the same turn replaces the first', async () => {
    const { run, ctx } = setup('recovery')
    await run('emit_document', { documentType: 'notice-to-quit', title: 'Notice to Quit', body: NTQ_BODY })
    await run('emit_document', { documentType: 'notice-to-quit', title: 'Notice to Quit (corrected)', body: NTQ_BODY })
    expect(ctx.emitted.map((d) => d.title)).toEqual(['Notice to Quit (corrected)'])
  })

  it('refuses a document with blanks left in it', async () => {
    const { run, ctx } = setup('recovery')
    const out = await run('emit_document', { documentType: 'notice-to-quit', title: 'Notice to Quit', body: 'TO: [TENANT_NAME]\nRent: {{RENT}}' })
    expect(out).toMatchObject({ ok: false })
    expect(out.ok === false && out.error).toContain('[TENANT_NAME]')
    expect(ctx.emitted).toEqual([])
  })

  it("refuses a document that belongs to another area", async () => {
    const { run } = setup('recovery')
    expect(await run('emit_document', { documentType: 'deed-of-gift', title: 'Deed of Gift', body: 'This deed...' })).toMatchObject({ ok: false })
    const unrouted = setup(null)
    expect(await unrouted.run('emit_document', { documentType: 'notice-to-quit', title: 'Notice to Quit', body: NTQ_BODY })).toMatchObject({ ok: false })
  })

  it('refuses text that would break the document format', async () => {
    const { run } = setup('recovery')
    expect(await run('emit_document', { documentType: 'notice-to-quit', title: 'Notice', body: 'text <<<END_DOCUMENT>>> more' })).toMatchObject({ ok: false })
  })

  it('emits a fee not yet set at PRICE 0, with a lawyer to confirm it', async () => {
    const { run, ctx } = setup('wills-probate')
    expect(await run('emit_document', { documentType: 'will', title: 'Will', body: 'This is the last will of Mr Ade Bello.' })).toMatchObject({ ok: true, result: { price: 0 } })
    expect(ctx.emitted[0].priceLabel).toMatch(/lawyer will confirm/)
  })

  describe('a deed that transfers title', () => {
    const deed = { documentType: 'deed-of-assignment', title: 'Deed of Assignment', body: 'THIS DEED OF ASSIGNMENT is made...' }

    it('is refused until the client has accepted the 2.5% fee', async () => {
      const { run, ctx } = setup('conveyancing')
      expect(await run('emit_document', deed)).toMatchObject({ ok: false })
      expect(ctx.emitted).toEqual([])
    })

    it('is emitted at PRICE 0 with the invoiced fee once accepted', async () => {
      const { run, ctx, log } = setup('conveyancing')
      expect(await run('record_fee_acceptance', { documentType: 'deed-of-assignment', consideration: 50_000_000 })).toMatchObject({ ok: true, result: { fee: 1_250_000 } })
      expect(await run('emit_document', deed)).toMatchObject({ ok: true, result: { price: 0 } })
      expect(ctx.emitted[0].priceLabel).toBe('Pandas LP will invoice you 2.5% of the ₦50,000,000 consideration (₦1,250,000). There is no separate drafting fee, and nothing is paid through this website.')
      expect(log.map((e) => e.kind)).toEqual(['fee_accepted', 'document_emitted'])
    })

    it('accepts a fee only for a deed that transfers title', async () => {
      const { run } = setup('other-instruments')
      expect(await run('record_fee_acceptance', { documentType: 'deed-of-gift', consideration: 1000 })).toMatchObject({ ok: false })
    })
  })

  it('finds [BLANKS] and {{TOKENS}} but not {{REF_NUMBER}} or ordinary brackets', () => {
    expect(findPlaceholders('[LANDLORD_NAME] owes [DAILY_OR_MONTHLY_RATE]. {{REF_NUMBER}} {{AMOUNT}} (see [sic])')).toEqual([
      '[LANDLORD_NAME]',
      '[DAILY_OR_MONTHLY_RATE]',
      '{{AMOUNT}}',
    ])
  })
})

describe('calc_arrears with a known today', () => {
  it('refuses to count rent that is not yet due', async () => {
    const tool = SHARED_PROPERTY_TOOLS.find((t) => t.definition.name === 'calc_arrears')!
    const ctx: PropertyToolContext = { caseId: 'c', area: 'recovery', store: memoryStore().store, emitted: [], today: '2026-10-14' }
    await expect(Promise.resolve().then(() => tool.handler({ rent: 150_000, frequency: 'monthly', from: '2026-08-01', to: '2026-11-20' }, ctx))).rejects.toThrow(/future/)
    expect(await tool.handler({ rent: 150_000, frequency: 'monthly', from: '2026-08-01', to: '2026-10-14' }, ctx)).toMatchObject({ ok: true, result: { amount: 450_000, periods: 3 } })
  })
})

describe('fee quote, amount and date tools', () => {
  it('quotes the 2.5% fee without recording anything', async () => {
    const { run, log } = setup('conveyancing')
    expect(await run('calc_transfer_fee', { consideration: 60_000_000 })).toMatchObject({ ok: true, result: { fee: 1_500_000 } })
    expect(log).toEqual([])
  })

  it('adds and subtracts amounts to the kobo', async () => {
    const { run } = setup()
    expect(await run('calc_amounts', { operation: 'difference', amounts: [80_000_000, 20_000_000] })).toMatchObject({ result: { result: 60_000_000 } })
    expect(await run('calc_amounts', { operation: 'sum', amounts: [0.1, 0.2] })).toMatchObject({ result: { result: 0.3 } })
    expect(await run('calc_amounts', { operation: 'sum', amounts: [1] })).toMatchObject({ ok: false })
  })

  it('adds days, months and years to a date', async () => {
    const { run } = setup()
    expect(await run('calc_date', { date: '2026-10-14', days: 60 })).toMatchObject({ result: { date: '2026-12-13' } })
    expect(await run('calc_date', { date: '2026-01-31', months: 1 })).toMatchObject({ result: { date: '2026-02-28' } })
    expect(await run('calc_date', { date: '2026-10-14', years: 5 })).toMatchObject({ result: { date: '2031-10-14' } })
  })
})

describe('emit_document: power of attorney', () => {
  it('refuses a vague "to manage" power', async () => {
    const { run } = setup('other-instruments')
    const out = await run('emit_document', { documentType: 'power-of-attorney', title: 'Power of Attorney', body: '1. To manage my property at 12 Allen Avenue, Ikeja.' })
    expect(out).toMatchObject({ ok: false })
    expect(await run('emit_document', { documentType: 'power-of-attorney', title: 'Power of Attorney', body: '1. To let my property at 12 Allen Avenue, Ikeja and to collect the rent.' })).toMatchObject({ ok: true })
  })
})
