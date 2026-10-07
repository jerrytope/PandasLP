import { describe, it, expect, vi } from 'vitest'

// buildBrandFactsMessage is pure; these keep the module's server imports from doing anything.
vi.mock('../supabaseAdmin', () => ({ supabaseAdmin: {} }))
vi.mock('../claude', () => ({ callClaude: vi.fn() }))

import { buildBrandFactsMessage } from '../brandLetter'
import { extractOutstandingQuestions } from '../agentChatParsing'

const brand = { name: 'LAPO Microfinance Bank', address: '18 Idowu Taylor Street, Lagos', contactEmail: 'ops@lapo.ng' }
const borrower = {
  fullName: 'Chinedu Okafor',
  phone: '08031234567',
  email: 'chinedu@example.com',
  addressForService: '12 Allen Avenue, Ikeja, Lagos',
  loanAmount: 500000,
  amountOutstanding: 350000,
  loanDate: '2026-01-15',
  lastPaymentDate: null,
  documentsLink: 'https://drive.google.com/file/d/abc/view',
  documentsFileId: 'abc',
  notes: '',
}

describe('buildBrandFactsMessage', () => {
  const message = buildBrandFactsMessage(brand, borrower, 'LAPO-0001')

  it('relays the client, the debtor and the debt the way a lawyer would', () => {
    expect(message).toContain('Our client is LAPO Microfinance Bank of 18 Idowu Taylor Street, Lagos')
    expect(message).toContain('Debtor (the borrower): Chinedu Okafor')
    expect(message).toContain('₦500,000, disbursed to the debtor on 15 January 2026')
    expect(message).toContain('Amount now outstanding and due: ₦350,000')
    expect(message).toContain('no record of any repayment')
    expect(message).toContain('LAPO-0001')
  })

  it('fixes the delivery choice (Pandas LP serves) so the agent never stops to ask it', () => {
    expect(message).toContain('Template B')
  })

  it('tells the agent to list gaps rather than guess them', () => {
    expect(message).toContain('OUTSTANDING QUESTIONS FOR YOUR CLIENT')
  })
})

describe('extractOutstandingQuestions', () => {
  it('reads the bullets under the heading', () => {
    const reply = `I need two things first.

OUTSTANDING QUESTIONS FOR YOUR CLIENT
- What was the agreed repayment date?
- Is there a guarantor on the loan?

Once you have these I'll draft it.`
    expect(extractOutstandingQuestions(reply)).toEqual(['What was the agreed repayment date?', 'Is there a guarantor on the loan?'])
  })

  it('returns nothing when there are no questions', () => {
    expect(extractOutstandingQuestions('Here is your letter.')).toEqual([])
  })
})
