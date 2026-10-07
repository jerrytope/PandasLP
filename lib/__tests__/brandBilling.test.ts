import { describe, it, expect } from 'vitest'
import { invoiceLines, lagosMonthRange, monthLabel, type BillableLetter } from '../brandBilling'
import { sniffEvidence } from '../brandExceptions'
import { getBrandEditNoticeEmail } from '../brandEmails'

describe('Lagos months', () => {
  it('a month starts and ends at midnight in Lagos (23:00 UTC the day before)', () => {
    expect(lagosMonthRange('2026-10')).toEqual({ start: '2026-09-30T23:00:00.000Z', end: '2026-10-31T23:00:00.000Z' })
    expect(lagosMonthRange('2026-12')!.end).toBe('2026-12-31T23:00:00.000Z')
  })
  it('rejects anything that isn’t YYYY-MM', () => {
    expect(lagosMonthRange('2026-13')).toBeNull()
    expect(lagosMonthRange('Oct 2026')).toBeNull()
  })
  it('names the month', () => {
    expect(monthLabel('2026-10')).toBe('October 2026')
  })
})

describe('invoice lines', () => {
  const letter = (id: string, fee: number | null, name = 'Ada Obi'): BillableLetter => ({
    id,
    case_ref: `MONIE-000${id}`,
    borrower: { 'Borrower Full Name': name },
    billable_at: '2026-10-08T09:00:00.000Z',
    billable_fee_kobo: fee,
  })

  it('one line per letter: Case ID, borrower and approval date, at the fee fixed on approval', () => {
    const { items, letterIds } = invoiceLines([letter('1', 500000), letter('2', null, 'Bola Ade')], 750000)
    expect(items).toEqual([
      { description: 'MONIE-0001 · Ada Obi · letter of demand, approved 8 Oct 2026', amount_kobo: 500000 },
      { description: 'MONIE-0002 · Bola Ade · letter of demand, approved 8 Oct 2026', amount_kobo: 750000 },
    ])
    expect(letterIds).toEqual(['1', '2'])
  })
  it('a free letter is not a line', () => {
    expect(invoiceLines([letter('1', 0)], 0).items).toEqual([])
  })
})

describe('court approval copies', () => {
  it('recognises a PDF, a PNG and a JPG by their first bytes', () => {
    expect(sniffEvidence(Buffer.from('%PDF-1.7 ...'))?.ext).toBe('pdf')
    expect(sniffEvidence(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext).toBe('png')
    expect(sniffEvidence(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg')
  })
  it('refuses anything else, whatever it is called', () => {
    expect(sniffEvidence(Buffer.from('<html>approved</html>'))).toBeNull()
    expect(sniffEvidence(Buffer.from('MZ executable'))).toBeNull()
  })
})

describe('email to the brand about edited rows', () => {
  it('lists each change and asks for Notes instead', () => {
    const e = getBrandEditNoticeEmail('Moniepoint', [{ caseRef: 'MONIE-0001', column: 'Email', oldValue: 'a@x.com', newValue: 'b@x.com' }])
    expect(e.subject).toBe("Changes to rows we're already handling | Moniepoint")
    expect(e.text).toContain('MONIE-0001: Email changed from "a@x.com" to "b@x.com"')
    expect(e.text).toContain('We have not acted on these changes')
    expect(e.text).toContain('Notes column')
  })
})
