import { describe, it, expect } from 'vitest'
import { getBorrowerEmail, responseDeadline, type BorrowerEmailData } from '../brandEmails'
import { dueReminder, isSendingHours } from '../brandServing'

const base: BorrowerEmailData = {
  kind: 'service',
  borrowerName: 'Adebayo Ogunleye',
  brandName: 'Moniepoint',
  caseRef: 'MONIE-0001',
  amountOutstanding: 380000,
  servedAt: '2026-10-08T09:00:00.000Z',
}

describe('borrower emails', () => {
  it('serving: names the client, the amount, the reference and the 14-day deadline', () => {
    const e = getBorrowerEmail(base)
    expect(e.subject).toBe('Letter of demand on behalf of Moniepoint | MONIE-0001')
    expect(e.text).toContain('We act for Moniepoint')
    expect(e.text).toContain('₦380,000')
    expect(e.text).toContain('until 22 October 2026')
    expect(e.text).toContain('Our reference: MONIE-0001')
  })

  it('Day 7: says when it was served and how long is left', () => {
    const e = getBorrowerEmail({ ...base, kind: 'day7' })
    expect(e.subject).toBe('Reminder: 7 days left to respond | MONIE-0001')
    expect(e.text).toContain('On 8 October 2026 we served you')
    expect(e.text).toContain('until 22 October 2026')
  })

  it('Day 14: court is only something the client MAY instruct, never a promise', () => {
    const e = getBorrowerEmail({ ...base, kind: 'day14' })
    expect(e.subject).toBe('Response period ended | MONIE-0001')
    expect(e.text).toContain('Our client may now instruct us')
    expect(e.text).not.toMatch(/we will (file|sue|take you to court)/i)
  })

  it('falls back to the letter when the sheet amount could not be read', () => {
    expect(getBorrowerEmail({ ...base, amountOutstanding: null }).text).toContain('for the sum stated in our letter')
  })

  it('escapes names typed into the sheet before putting them in HTML', () => {
    const e = getBorrowerEmail({ ...base, borrowerName: '<script>x</script>' })
    expect(e.html).not.toContain('<script>')
    expect(e.html).toContain('&lt;script&gt;')
  })

  it('the deadline is a Lagos date: served at 23:30 UTC is already the next day in Lagos', () => {
    expect(responseDeadline('2026-10-08T23:30:00.000Z')).toBe('23 October 2026')
  })
})

describe('when reminders are due', () => {
  const served = '2026-10-01T09:00:00.000Z'
  const at = (iso: string) => new Date(iso)
  const c = { status: 'served' as const, served_at: served, day7_sent_at: null, day14_sent_at: null }

  it('nothing before day 7', () => {
    expect(dueReminder(c, at('2026-10-08T08:59:00.000Z'))).toBeNull()
  })
  it('Day 7 from 7 days after serving', () => {
    expect(dueReminder(c, at('2026-10-08T09:00:00.000Z'))?.kind).toBe('day7')
  })
  it('Day 14 only once Day 7 has gone', () => {
    expect(dueReminder(c, at('2026-10-20T09:00:00.000Z'))?.kind).toBe('day7')
    const after7 = { ...c, status: 'day7_sent' as const, day7_sent_at: '2026-10-08T09:00:00.000Z' }
    expect(dueReminder(after7, at('2026-10-14T09:00:00.000Z'))).toBeNull()
    expect(dueReminder(after7, at('2026-10-15T09:00:00.000Z'))?.kind).toBe('day14')
  })
  it('never for a borrower who paid, disputed or is closed', () => {
    for (const status of ['paid', 'disputed', 'closed'] as const) {
      expect(dueReminder({ ...c, status }, at('2026-10-20T09:00:00.000Z'))).toBeNull()
    }
  })
  it('never twice', () => {
    const done = { ...c, status: 'day14_sent' as const, day7_sent_at: served, day14_sent_at: served }
    expect(dueReminder(done, at('2026-12-01T09:00:00.000Z'))).toBeNull()
  })
})

describe('sending hours (Lagos, UTC+1)', () => {
  it('08:00 to 19:59 Lagos only', () => {
    expect(isSendingHours(new Date('2026-10-08T06:59:00.000Z'))).toBe(false) // 07:59 Lagos
    expect(isSendingHours(new Date('2026-10-08T07:00:00.000Z'))).toBe(true) // 08:00 Lagos
    expect(isSendingHours(new Date('2026-10-08T18:59:00.000Z'))).toBe(true) // 19:59 Lagos
    expect(isSendingHours(new Date('2026-10-08T19:00:00.000Z'))).toBe(false) // 20:00 Lagos
  })
})
