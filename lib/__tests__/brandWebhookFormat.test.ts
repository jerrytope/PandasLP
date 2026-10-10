import { describe, it, expect } from 'vitest'
import {
  buildWebhookBody,
  GIVE_UP_AFTER_MS,
  nextAttemptAt,
  RETRY_DELAYS_MINUTES,
  signWebhook,
  verifyWebhookSignature,
  webhookUrlProblem,
  type WebhookInput,
} from '../brandWebhookFormat'

const input = (over: Partial<WebhookInput> = {}): WebhookInput => ({
  deliveryId: 'd-1',
  event: 'borrower.served',
  occurredAt: '2026-10-10T09:00:00.000Z',
  isTest: false,
  caseRef: 'MONIE-0004',
  loanId: 'LN-77',
  detail: {},
  siteUrl: 'https://pandaslp.com.ng/',
  ...over,
})

describe('webhook bodies', () => {
  it('carries our Case ID, their loan ID and a stable id for spotting repeats', () => {
    expect(buildWebhookBody(input())).toEqual({
      id: 'd-1',
      event: 'borrower.served',
      occurred_at: '2026-10-10T09:00:00.000Z',
      test: false,
      data: {
        case_id: 'MONIE-0004',
        loan_id: 'LN-77',
        status: 'served',
        served_at: '2026-10-10T09:00:00.000Z',
        letter_url: 'https://pandaslp.com.ng/api/v1/borrowers/MONIE-0004/letter',
      },
    })
  })

  it('missing documents lists exactly what is missing', () => {
    const body = buildWebhookBody(input({ event: 'borrower.missing_documents', detail: { missing: ['Email (needed to send the reminders)'] } }))
    expect(body.data).toMatchObject({ status: 'missing_documents', missing: ['Email (needed to send the reminders)'] })
  })

  it('an approval says the letter can be pulled now', () => {
    expect(buildWebhookBody(input({ event: 'borrower.lawyer_approved' })).data).toMatchObject({ status: 'lawyer_approved', letter_available: true })
  })

  it('an outcome carries it; awaiting decision says since when', () => {
    expect(buildWebhookBody(input({ event: 'borrower.outcome', detail: { outcome: 'paid', note: 'internal' } })).data).toEqual({
      case_id: 'MONIE-0004',
      loan_id: 'LN-77',
      status: 'paid',
      outcome: 'paid',
    }) // staff notes never go to the brand
    expect(buildWebhookBody(input({ event: 'borrower.awaiting_decision' })).data).toMatchObject({ awaiting_decision_since: '2026-10-10T09:00:00.000Z' })
  })

  it('test borrowers are marked test', () => {
    expect(buildWebhookBody(input({ isTest: true })).test).toBe(true)
  })
})

describe('signatures', () => {
  const body = '{"id":"d-1"}'
  const now = 1_790_000_000

  it('the brand can check a call came from us', () => {
    const header = signWebhook('whsec_abc', body, now)
    expect(header).toMatch(/^t=1790000000,v1=[0-9a-f]{64}$/)
    expect(verifyWebhookSignature('whsec_abc', body, header, now + 30)).toBe(true)
  })

  it('a changed body, the wrong secret, or an old call is refused', () => {
    const header = signWebhook('whsec_abc', body, now)
    expect(verifyWebhookSignature('whsec_abc', '{"id":"d-2"}', header, now)).toBe(false)
    expect(verifyWebhookSignature('whsec_other', body, header, now)).toBe(false)
    expect(verifyWebhookSignature('whsec_abc', body, header, now + 301)).toBe(false)
    expect(verifyWebhookSignature('whsec_abc', body, 'garbage', now)).toBe(false)
  })
})

describe('retries', () => {
  const created = new Date('2026-10-10T00:00:00Z')

  it('waits longer after each failure', () => {
    expect(nextAttemptAt(1, created, created)!.getTime() - created.getTime()).toBe(60_000)
    expect(nextAttemptAt(2, created, created)!.getTime() - created.getTime()).toBe(5 * 60_000)
  })

  it('the waits add up to just under 24 hours, then it gives up', () => {
    const total = RETRY_DELAYS_MINUTES.reduce((a, b) => a + b, 0) * 60_000
    expect(total).toBeLessThan(GIVE_UP_AFTER_MS)
    expect(total).toBeGreaterThan(GIVE_UP_AFTER_MS - 60 * 60_000)
    expect(nextAttemptAt(RETRY_DELAYS_MINUTES.length + 1, created, created)).toBeNull()
  })

  it('never schedules past 24 hours from when the update was queued', () => {
    const late = new Date(created.getTime() + 23 * 60 * 60_000)
    expect(nextAttemptAt(8, created, late)).toBeNull() // the next wait (8 hours) would pass 24 hours
  })
})

describe('web addresses', () => {
  it('only public https addresses', () => {
    expect(webhookUrlProblem('https://hooks.lender.ng/pandas')).toBeNull()
    expect(webhookUrlProblem('http://hooks.lender.ng/pandas')).toBe('must start with https://')
    expect(webhookUrlProblem('https://127.0.0.1/hook')).toBe('points to a private address')
    expect(webhookUrlProblem('https://localhost/hook')).toBe('points to a private address')
  })
})
