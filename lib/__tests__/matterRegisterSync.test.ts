import { describe, expect, it } from 'vitest'
import { buildRegisterRow, matterName, nairaFigure } from '../matterRegisterRow'

describe('matter register row construction', () => {
  it('parses naira values without treating non-finite amounts as valid', () => {
    expect(nairaFigure('Claim: ₦300,000.00')).toBe(300000)
    expect(nairaFigure('No amount provided')).toBeNull()
  })

  it('uses the letter title as the matter name when present', () => {
    expect(matterName('Letter of Demand — Joel v Daniel', null, null)).toBe('Joel v Daniel')
    expect(matterName(null, 'Joel', 'Daniel')).toBe('Joel v Daniel')
  })

  it('maps case facts and service tier to a register row', () => {
    const row = buildRegisterRow({
      id: 'case-1',
      case_number: 14,
      status: 'paid',
      created_at: '2026-03-01T10:00:00.000Z',
      paid_at: '2026-03-02T10:00:00.000Z',
      document_title: 'Letter of Demand — Joel v Daniel',
      document_body: [
        'Our Ref: PLP/2026/000014',
        'Daniel Efetobore',
        'Dear Sir,',
        'We are legal representatives of Joel Ukpebor of Lagos ("our Client").',
        'We demand payment of the sum of **₦300,000.00 (Three Hundred Thousand Naira)**.',
      ].join('\n'),
      amount_paid: 40000,
      delivery_option: 'pandas-serves',
      client_phone: '+2348000000000',
      client_email: null,
      userEmail: 'joel@example.com',
    }, '2026-03-03')

    expect(row).toMatchObject({
      caseId: 'case-1',
      systemRef: 'PLP/2026/000014',
      matter: 'Joel v Daniel',
      client: 'Joel Ukpebor',
      amountOwed: 300000,
      status: 'Outstanding',
      dateOpened: '2026-03-01',
      lastUpdated: '2026-03-03',
    })
    expect(row.contact).toContain('+2348000000000')
    expect(row.contact).toContain('joel@example.com')
    expect(row.discussion).toContain('Pandas LP serves')
  })
})
