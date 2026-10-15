import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))

import type { ModelCaller } from '../agentRuntime/types'
import type { ClaudeContentBlock } from '../claude'
import { AREAS, ENABLED_AREAS, areaBlock, areaDocuments } from '../property/areas'
import { findStateInText, groupOf, jurisdictionBlock, normaliseLagosArea, normaliseState } from '../property/jurisdictions'
import { routeFreeText } from '../property/router'
import { AREA_BUTTONS, PROPERTY_V2_STARTER, areaFromButton } from '../property/starter'
import { consentAdvice } from '../property/tools/consentApplication'
import { PROPERTY_DOCUMENTS, type PropertyDocumentKey } from '../propertyPricing'
import { extractOptions } from '../agentChatParsing'

function modelReplying(content: ClaudeContentBlock[]): ModelCaller {
  return async () => ({
    ok: true,
    text: '',
    content,
    stopReason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 },
    costUsd: 0,
    model: 'test',
  })
}

describe('starter buttons', () => {
  it('map straight to an area, including the old starter labels', () => {
    for (const b of AREA_BUTTONS) expect(areaFromButton(b.label)).toBe(b.area)
    expect(areaFromButton('Draw up a Power of Attorney')).toBe('other-instruments')
    expect(areaFromButton('  something ELSE ')).toBe('something-else')
    expect(areaFromButton('My tenant has not paid for a year')).toBeNull()
  })

  it('offer the seven areas and Something else as buttons', () => {
    expect(extractOptions(PROPERTY_V2_STARTER).options).toHaveLength(8)
  })
})

describe('jurisdictions', () => {
  it('reads the state from a button or a sentence', () => {
    expect(normaliseState('FCT (Abuja)')).toBe('FCT')
    expect(normaliseState('lagos state')).toBe('Lagos')
    expect(findStateInText("It's in Ikeja, Lagos")).toBe('Lagos')
    expect(findStateInText('a house in Abuja')).toBe('FCT')
    expect(findStateInText('Cross-River')).toBe('Cross River')
  })

  it('recognises a Nigerian state the firm does not cover', () => {
    expect(findStateInText('Kano')).toBe('unsupported')
    expect(findStateInText('Port Harcourt, Rivers State')).toBe('unsupported')
    expect(findStateInText('somewhere in Nigeria')).toBeNull()
    expect(findStateInText('Lagos or Ogun, not sure')).toBeNull()
  })

  it('groups the states by the law that applies', () => {
    expect(groupOf('Lagos')).toBe('lagos')
    expect(groupOf('FCT')).toBe('fct')
    expect(groupOf('Delta')).toBe('western')
    expect(groupOf('Enugu')).toBe('ca')
    expect(groupOf('Kano')).toBeNull()
  })

  it('names the right law in the Lagos excluded areas', () => {
    expect(normaliseLagosArea('Victoria Island')).toBe('victoria-island')
    expect(normaliseLagosArea('Elsewhere in Lagos')).toBe('elsewhere')
    expect(jurisdictionBlock('Lagos', 'ikoyi')).toMatch(/Rent Control and Recovery of Residential Premises Law/)
    expect(jurisdictionBlock('Lagos', 'elsewhere')).not.toMatch(/Rent Control/)
  })
})

describe('area configs', () => {
  it('all seven areas are live since Phase 4', () => {
    expect(ENABLED_AREAS).toEqual(['recovery', 'tenancy', 'conveyancing', 'other-instruments', 'searches', 'wills-probate', 'land-dispute'])
  })

  it('give every enabled area its rules for all four state groups', () => {
    for (const id of ENABLED_AREAS) {
      for (const rules of Object.values(AREAS[id].jurisdictionRules)) expect(rules.length).toBeGreaterThan(20)
    }
  })

  it('include a template for every document an enabled area may emit', () => {
    const templateFor: Partial<Record<PropertyDocumentKey, RegExp>> = {
      'notice-to-quit': /TEMPLATE — NOTICE TO QUIT/, 'seven-days-notice': /TEMPLATE — SEVEN DAYS' NOTICE/,
      'rent-demand-letter': /TEMPLATE — RENT DEMAND LETTER/, 'tenancy-agreement': /TEMPLATE — TENANCY AGREEMENT/,
      'deed-of-lease': /TEMPLATE — DEED OF LEASE/, 'sublease-agreement': /TEMPLATE — SUBLEASE AGREEMENT/,
      'deed-of-sublease': /TEMPLATE — DEED OF SUBLEASE/, 'deed-of-assignment': /TEMPLATE — DEED OF ASSIGNMENT/,
      'deed-of-gift': /TEMPLATE — DEED OF GIFT/, 'legal-mortgage': /TEMPLATE — DEED OF LEGAL MORTGAGE/,
      'power-of-attorney': /TEMPLATE — POWER OF ATTORNEY/, 'agreement-for-sale': /TEMPLATE — AGREEMENT FOR SALE/,
      'deed-of-release': /TEMPLATE — DEED OF RELEASE/, 'search-instruction-standard': /TEMPLATE — PROPERTY SEARCH INSTRUCTION/,
      'consent-application': /TEMPLATE — APPLICATION FOR GOVERNOR'S CONSENT/,
      will: /TEMPLATE — WILL:/, codicil: /TEMPLATE — CODICIL/, 'probate-papers': /TEMPLATE — PROBATE \/ ADMINISTRATION APPLICATION/,
      assent: /TEMPLATE — EXECUTORS' ASSENT/, 'dispute-brief': /TEMPLATE — LAWYER BRIEF: LAND TITLE DISPUTE/,
    }
    for (const id of ENABLED_AREAS) {
      const block = areaBlock(AREAS[id])
      for (const doc of areaDocuments(id)) {
        if (doc === 'search-instruction-comprehensive') continue // a lawyer quotes it; no document is emitted
        expect(templateFor[doc], `${id}: ${doc}`).toBeDefined()
        expect(block, `${id}: ${doc}`).toMatch(templateFor[doc]!)
      }
    }
  })

  it('hand off only to real areas, and never to themselves', () => {
    for (const a of Object.values(AREAS)) for (const h of a.handoffs) {
      expect(AREAS[h.to]).toBeDefined()
      expect(h.to).not.toBe(a.id)
    }
  })

  it('keep the Power of Attorney irrevocability rule', () => {
    const block = areaBlock(AREAS['other-instruments'])
    expect(block).toMatch(/NOT MORE THAN ONE YEAR/)
    expect(block).not.toMatch(/IF IRREVOCABLE WITHOUT PRIOR CONSIDERATION/)
  })

  it('put a quit date in the Notice to Quit', () => {
    expect(areaBlock(AREAS.recovery)).toMatch(/on or before \*\*\[QUIT_DATE\]\*\*/)
  })

  it('every document type belongs to at least one area', () => {
    for (const t of Object.keys(PROPERTY_DOCUMENTS) as PropertyDocumentKey[]) {
      expect(Object.keys(AREAS).some((a) => areaDocuments(a as never).includes(t))).toBe(true)
    }
  })
})

describe('consentAdvice', () => {
  it('sends a statutory right to the Governor under section 22', () => {
    expect(consentAdvice({ instrument: 'assignment', state: 'Oyo', titleType: 'statutory' })).toMatchObject({
      consentNeeded: true, authority: expect.stringMatching(/Governor of Oyo State/), provision: 'Section 22 of the Land Use Act',
    })
  })

  it('sends a customary right to the Local Government under section 21, but never in the FCT', () => {
    expect(consentAdvice({ instrument: 'gift', state: 'Enugu', titleType: 'customary' }).provision).toBe('Section 21 of the Land Use Act')
    expect(consentAdvice({ instrument: 'gift', state: 'FCT', titleType: 'customary' }).authority).toMatch(/Minister/)
  })

  it('needs no consent for a lease of three years or less', () => {
    expect(consentAdvice({ instrument: 'lease', state: 'Lagos', titleType: 'statutory', termYears: 3 }).consentNeeded).toBe(false)
    expect(consentAdvice({ instrument: 'sublease', state: 'Lagos', titleType: 'statutory', termYears: 5 }).consentNeeded).toBe(true)
  })

  it('reminds a company mortgagor about CAC registration', () => {
    expect(consentAdvice({ instrument: 'legal-mortgage', state: 'Lagos', titleType: 'statutory', partyIsCompany: true }).notes.join(' ')).toMatch(/90 days/)
  })

  it('refuses a state the firm does not cover', () => {
    expect(() => consentAdvice({ instrument: 'assignment', state: 'Kano', titleType: 'statutory' })).toThrow(RangeError)
  })
})

describe('routeFreeText', () => {
  const messages = [{ role: 'user' as const, content: 'My tenant in Ibadan has not paid rent for a year' }]

  it('routes, carrying a state the client mentioned', async () => {
    const call = modelReplying([{ type: 'tool_use', id: 't', name: 'route_to', input: { area: 'recovery', reason: 'Tenant owes rent.', state: 'Oyo' } }])
    expect(await routeFreeText({ messages, caseId: 'c', call })).toEqual({ kind: 'route', area: 'recovery', reason: 'Tenant owes rent.', state: 'Oyo' })
  })

  it('asks one clarifying question', async () => {
    const call = modelReplying([{ type: 'tool_use', id: 't', name: 'ask_clarifying', input: { question: 'Is the person your tenant?', options: ['Yes', 'No, they just moved in'] } }])
    expect(await routeFreeText({ messages, caseId: 'c', call })).toMatchObject({ kind: 'ask', options: ['Yes', 'No, they just moved in'] })
  })

  it('escalates', async () => {
    const call = modelReplying([{ type: 'tool_use', id: 't', name: 'escalate_to_lawyer', input: { reason: 'Land grabbers.', message: 'A lawyer will call you.' } }])
    expect(await routeFreeText({ messages, caseId: 'c', call })).toEqual({ kind: 'escalate', reason: 'Land grabbers.', message: 'A lawyer will call you.' })
  })

  it('falls back to a question when the model decides nothing', async () => {
    const call = modelReplying([{ type: 'text', text: 'Hmm.' }])
    expect(await routeFreeText({ messages, caseId: 'c', call })).toMatchObject({ kind: 'ask' })
  })

  it('uses the cheaper model', async () => {
    let model: string | undefined
    const call: ModelCaller = async (opts) => { model = opts.model; return modelReplying([{ type: 'text', text: '' }])(opts) }
    await routeFreeText({ messages, caseId: 'c', call })
    expect(model).toBe('claude-haiku-4-5')
  })
})
