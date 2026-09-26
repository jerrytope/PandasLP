import { describe, expect, it } from 'vitest'
import { addDaysYmd, balanceKobo, computeTotals, hasBankDetails, isOverdue, isValidEmail, statusFromPayments, validateItems } from '../invoices'

describe('invoices', () => {
  it('validates lines', () => {
    expect(validateItems([]).ok).toBe(false)
    expect(validateItems([{ description: ' ', amount_kobo: 100 }]).ok).toBe(false)
    expect(validateItems([{ description: 'Fees', amount_kobo: 0 }]).ok).toBe(false)
    expect(validateItems([{ description: 'Fees', amount_kobo: 1.5 }]).ok).toBe(false)
    const ok = validateItems([{ description: '  Settlement response  ', amount_kobo: 5_000_000 }])
    expect(ok).toEqual({ ok: true, items: [{ description: 'Settlement response', amount_kobo: 5_000_000 }] })
  })

  it('totals with and without VAT', () => {
    const items = [{ description: 'Fees', amount_kobo: 5_000_000 }]
    expect(computeTotals(items, 0)).toEqual({ subtotal_kobo: 5_000_000, vat_kobo: 0, total_kobo: 5_000_000 })
    expect(computeTotals(items, 7.5)).toEqual({ subtotal_kobo: 5_000_000, vat_kobo: 375_000, total_kobo: 5_375_000 })
  })

  it('derives status from payments', () => {
    expect(statusFromPayments('sent', 5_000_000, 0)).toBe('sent')
    expect(statusFromPayments('sent', 5_000_000, 2_000_000)).toBe('part_paid')
    expect(statusFromPayments('part_paid', 5_000_000, 5_000_000)).toBe('paid')
    expect(statusFromPayments('void', 5_000_000, 5_000_000)).toBe('void')
    expect(statusFromPayments('draft', 5_000_000, 0)).toBe('draft')
    expect(balanceKobo({ total_kobo: 5_000_000, amount_paid_kobo: 6_000_000 })).toBe(0)
  })

  it('knows when an invoice is overdue', () => {
    expect(addDaysYmd('2026-09-26', 7)).toBe('2026-10-03')
    expect(isOverdue({ status: 'sent', due_date: '2026-10-03' }, '2026-10-04')).toBe(true)
    expect(isOverdue({ status: 'sent', due_date: '2026-10-03' }, '2026-10-03')).toBe(false)
    expect(isOverdue({ status: 'paid', due_date: '2026-10-03' }, '2026-12-01')).toBe(false)
    expect(isOverdue({ status: 'draft', due_date: '2026-10-03' }, '2026-12-01')).toBe(false)
  })

  it('checks bank details and emails', () => {
    expect(hasBankDetails({ bank_account_name: 'Pandas LP', bank_account_number: '0123456789', bank_name: 'Bank' })).toBe(true)
    expect(hasBankDetails({ bank_account_name: 'Pandas LP', bank_account_number: '', bank_name: 'Bank' })).toBe(false)
    expect(isValidEmail('ukpeborjoel@gmail.com')).toBe(true)
    expect(isValidEmail('not an email')).toBe(false)
  })
})
