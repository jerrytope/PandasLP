import { describe, expect, it } from 'vitest'
import { agentOpener, assessDebt, normaliseNgPhone, parseAnswers, type DebtCheckAnswers } from '../debtCheck'

const base: DebtCheckAnswers = {
  debtor: 'business',
  amountNaira: 450_000,
  age: 'under_1',
  proof: ['invoice', 'messages'],
  admission: 'verbally',
  location: 'address',
  state: 'lagos',
}

describe('assessDebt', () => {
  it('rates written proof, a known address and no dispute as strong, routed to small claims', () => {
    const r = assessDebt(base)
    expect(r.verdict).toBe('strong')
    expect(r.nextStep).toBe('demand_letter')
    expect(r.court).toBe('small_claims')
    expect(r.nextStepText).toContain('₦10,000')
  })

  it('drops to good when the debtor disputes it', () => {
    expect(assessDebt({ ...base, admission: 'disputes' }).verdict).toBe('good')
  })

  it('drops to good with only a phone number', () => {
    expect(assessDebt({ ...base, location: 'phone_only' }).verdict).toBe('good')
  })

  it('is possible with only a witness', () => {
    expect(assessDebt({ ...base, proof: ['witness'], admission: 'not_asked' }).verdict).toBe('possible')
  })

  it('is difficult with nothing written, no admission, and sends it to a free lawyer review', () => {
    const r = assessDebt({ ...base, proof: ['none'], admission: 'disputes' })
    expect(r.verdict).toBe('difficult')
    expect(r.nextStep).toBe('lawyer_review')
  })

  it('is difficult when the debtor cannot be reached, even with proof', () => {
    expect(assessDebt({ ...base, location: 'unknown' }).verdict).toBe('difficult')
  })

  it('sends debts over six years old to a lawyer before any spend', () => {
    const r = assessDebt({ ...base, age: 'over_6' })
    expect(r.verdict).toBe('review')
    expect(r.nextStep).toBe('lawyer_review')
    expect(r.points[0].text).toMatch(/six years/)
  })

  it('always sends government debtors to a lawyer', () => {
    const r = assessDebt({ ...base, debtor: 'government' })
    expect(r.verdict).toBe('review')
    expect(r.nextStep).toBe('lawyer_review')
  })

  it('offers both routes for a tenant owing rent', () => {
    const r = assessDebt({ ...base, debtor: 'tenant' })
    expect(r.nextStep).toBe('property')
    expect(r.nextStepText).toContain('₦25,000')
    expect(r.nextStepText).toContain('₦10,000')
  })

  it('routes over ₦5 million to the High Court and outside Lagos to "depends"', () => {
    expect(assessDebt({ ...base, amountNaira: 5_000_000 }).court).toBe('small_claims')
    expect(assessDebt({ ...base, amountNaira: 5_000_001 }).court).toBe('high_court')
    expect(assessDebt({ ...base, state: 'other' }).court).toBe('depends')
  })

  it('treats "none" alongside real proof as the real proof', () => {
    expect(assessDebt({ ...base, proof: ['none', 'agreement'] }).verdict).toBe('strong')
  })
})

describe('parseAnswers', () => {
  it('accepts valid answers and de-duplicates proof', () => {
    const r = parseAnswers({ ...base, proof: ['invoice', 'invoice'], amountNaira: '450000.4' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.answers.proof).toEqual(['invoice'])
      expect(r.answers.amountNaira).toBe(450000)
    }
  })

  it.each([
    [{ ...base, debtor: 'alien' }],
    [{ ...base, amountNaira: 0 }],
    [{ ...base, amountNaira: 'abc' }],
    [{ ...base, age: 'yesterday' }],
    [{ ...base, proof: [] }],
    [{ ...base, proof: ['invoice', 'forged'] }],
    [{ ...base, admission: 'maybe' }],
    [{ ...base, location: 'moon' }],
    [{ ...base, state: 'ghana' }],
    [null],
  ])('rejects bad input %#', (input) => {
    expect(parseAnswers(input).ok).toBe(false)
  })
})

describe('normaliseNgPhone', () => {
  it.each([
    ['08031234567', '2348031234567'],
    ['0803 123 4567', '2348031234567'],
    ['+234 803 123 4567', '2348031234567'],
    ['2347011234567', '2347011234567'],
    ['09121234567', '2349121234567'],
  ])('%s → %s', (input, out) => {
    expect(normaliseNgPhone(input)).toBe(out)
  })

  it.each(['12345', '0803123456', '08031234567890', '06031234567', ''])('rejects %s', (input) => {
    expect(normaliseNgPhone(input)).toBeNull()
  })
})

describe('agentOpener', () => {
  it('summarises the answers in plain words for the agent', () => {
    const s = agentOpener(base)
    expect(s).toContain('₦450,000')
    expect(s).toContain('a business or company')
    expect(s).toContain('an invoice or receipt')
  })

  it('says so when nothing is written down', () => {
    expect(agentOpener({ ...base, proof: ['none'] })).toContain('don’t have anything written down')
  })
})
