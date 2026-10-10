// Monthly billing for brands (phase 4 of plans/). One draft invoice per brand per month in
// Finance → Invoices, one line per lawyer-approved letter not yet billed.
//
// "NEVER BILLED TWICE": a letter is claimed for an invoice with a conditional update
// (billed_invoice_id IS NULL → this invoice), so two people clicking at once can't both bill
// it. Voiding the invoice releases its letters for the next one. Missing Documents rows are
// never approved, so they never become billable.

import { supabaseAdmin } from './supabaseAdmin'
import { computeTotals, addDaysYmd, type InvoiceItem, type InvoiceRow } from './invoices'
import { INVOICE_COLUMNS, loadBillingSettings, normaliseInvoice } from './billing'
import { lagosToday } from './negotiationStatus'
import { logEvent } from './brandStore'

const LAGOS_DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' })

export interface BillableLetter {
  id: string
  case_ref: string
  borrower: Record<string, string> | null
  billable_at: string
  billable_fee_kobo: number | null
}

/** "2026-10" → the instants that month starts and ends in Lagos (UTC+1). */
export function lagosMonthRange(month: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const start = new Date(Date.UTC(y, mo - 1, 1) - 60 * 60 * 1000)
  const end = new Date(Date.UTC(y, mo, 1) - 60 * 60 * 1000)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** "2026-10" → "October 2026". */
export function monthLabel(month: string): string {
  const [y, mo] = month.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** One invoice line per letter. Letters with no fee (a free brand) aren't lines. Pure. */
export function invoiceLines(letters: BillableLetter[], fallbackFeeKobo: number): { items: InvoiceItem[]; letterIds: string[] } {
  const items: InvoiceItem[] = []
  const letterIds: string[] = []
  for (const l of letters) {
    const fee = Number(l.billable_fee_kobo ?? fallbackFeeKobo)
    if (!(fee > 0)) continue
    const name = l.borrower?.['Borrower Full Name']?.trim()
    items.push({
      description: `${l.case_ref}${name ? ` · ${name}` : ''} · letter of demand, approved ${LAGOS_DAY.format(new Date(l.billable_at))}`,
      amount_kobo: fee,
    })
    letterIds.push(l.id)
  }
  return { items, letterIds }
}

const LETTER_FIELDS = 'id, case_ref, borrower, billable_at, billable_fee_kobo'

/** Approved letters not on any invoice, approved before the end of `month` (earlier ones missed are included). */
export async function unbilledLetters(brandId: string, month?: string): Promise<BillableLetter[]> {
  let q = supabaseAdmin.from('brand_cases').select(LETTER_FIELDS).eq('brand_id', brandId).eq('is_test', false).not('billable_at', 'is', null).is('billed_invoice_id', null)
  if (month) {
    const range = lagosMonthRange(month)
    if (!range) return []
    q = q.lt('billable_at', range.end)
  }
  const { data } = await q.order('billable_at', { ascending: true }).order('case_ref', { ascending: true })
  return (data ?? []) as BillableLetter[]
}

export type CreateInvoiceResult = { ok: true; invoice: InvoiceRow; letters: number } | { ok: false; status: number; error: string }

export async function createBrandInvoice(brandId: string, month: string, actor: string): Promise<CreateInvoiceResult> {
  if (!lagosMonthRange(month)) return { ok: false, status: 400, error: 'Pick a month.' }
  const { data: brand } = await supabaseAdmin.from('brands').select('id, name, code, contact_emails, per_letter_fee_kobo').eq('id', brandId).single()
  if (!brand) return { ok: false, status: 404, error: 'Brand not found.' }

  const letters = await unbilledLetters(brandId, month)
  const first = invoiceLines(letters, Number(brand.per_letter_fee_kobo))
  if (first.items.length === 0) return { ok: false, status: 409, error: `No approved letters left to bill up to the end of ${monthLabel(month)}.` }

  const settings = await loadBillingSettings()
  const issueDate = lagosToday()
  const draft = (items: InvoiceItem[]) => ({ items, vat_rate: settings.vat_rate, ...computeTotals(items, settings.vat_rate) })
  const { data: created, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      brand_id: brand.id,
      client_name: brand.name,
      client_email: brand.contact_emails[0] ?? null,
      matter: `Loan recovery letters, ${monthLabel(month)}`,
      ...draft(first.items),
      issue_date: issueDate,
      due_date: addDaysYmd(issueDate, settings.payment_terms_days),
      notes: `${first.items.length} lawyer-approved letter${first.items.length === 1 ? '' : 's'} of demand for ${brand.name} (${brand.code}).`,
      created_by: actor,
    })
    .select('id, invoice_number')
    .single()
  if (error || !created) return { ok: false, status: 500, error: `Could not create the invoice. (${error?.message})` }

  // Claim the letters. Any that another invoice took first are dropped from this one.
  const { data: claimed } = await supabaseAdmin
    .from('brand_cases')
    .update({ billed_invoice_id: created.id })
    .in('id', first.letterIds)
    .is('billed_invoice_id', null)
    .select('id')
  const claimedIds = new Set((claimed ?? []).map((r) => r.id))
  if (claimedIds.size === 0) {
    await supabaseAdmin.from('invoices').delete().eq('id', created.id)
    return { ok: false, status: 409, error: 'These letters were just billed on another invoice.' }
  }
  if (claimedIds.size < first.letterIds.length) {
    const kept = invoiceLines(letters.filter((l) => claimedIds.has(l.id)), Number(brand.per_letter_fee_kobo))
    await supabaseAdmin.from('invoices').update(draft(kept.items)).eq('id', created.id)
  }

  for (const l of letters.filter((l) => claimedIds.has(l.id))) {
    await logEvent(l, 'billed', { invoice_id: created.id, invoice_number: created.invoice_number }, actor)
  }
  const { data: invoice } = await supabaseAdmin.from('invoices').select(INVOICE_COLUMNS).eq('id', created.id).single()
  return { ok: true, invoice: normaliseInvoice(invoice!), letters: claimedIds.size }
}

/** A voided brand invoice gives its letters back, so they go on the next one. */
export async function releaseVoidedInvoice(invoiceId: string, actor: string) {
  const { data: released } = await supabaseAdmin
    .from('brand_cases')
    .update({ billed_invoice_id: null })
    .eq('billed_invoice_id', invoiceId)
    .select('id, case_ref')
  for (const l of released ?? []) await logEvent(l, 'unbilled', { invoice_id: invoiceId, reason: 'invoice voided' }, actor)
  return released?.length ?? 0
}

/** For Admin → Brands → Billing: what's waiting to be billed, and the brand's invoices. */
export async function brandBillingSummary(brandId: string) {
  const [{ data: brand }, letters, { data: invoices }] = await Promise.all([
    supabaseAdmin.from('brands').select('per_letter_fee_kobo').eq('id', brandId).single(),
    unbilledLetters(brandId),
    supabaseAdmin.from('invoices').select('id, invoice_number, matter, status, total_kobo, issue_date, created_at').eq('brand_id', brandId).order('created_at', { ascending: false }),
  ])
  const lines = invoiceLines(letters, Number(brand?.per_letter_fee_kobo ?? 0))
  return {
    unbilled: lines.items.length,
    unbilledKobo: lines.items.reduce((s, i) => s + i.amount_kobo, 0),
    oldestUnbilledAt: letters[0]?.billable_at ?? null,
    invoices: (invoices ?? []).map((i) => ({ ...i, total_kobo: Number(i.total_kobo) })),
  }
}
