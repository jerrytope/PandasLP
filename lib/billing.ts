// Server-side billing helpers shared by the /api/admin/invoices* and settings routes.
import { supabaseAdmin } from './supabaseAdmin'
import { statusFromPayments, type BillingSettings, type InvoiceRow, type InvoiceStatus } from './invoices'
import { referenceFor } from './replyLetter.js'

export const INVOICE_COLUMNS =
  'id, invoice_number, case_id, client_name, client_email, matter, items, subtotal_kobo, vat_rate, vat_kobo, total_kobo, amount_paid_kobo, status, issue_date, due_date, notes, sent_at, paid_at, voided_at, void_reason, created_by, created_at'

const SETTINGS_COLUMNS = 'bank_account_name, bank_account_number, bank_name, vat_rate, tax_id, payment_terms_days, usd_ngn_rate'

// Postgres NUMERIC and BIGINT arrive as strings or numbers depending on size; normalise once.
export function normaliseInvoice(row: Record<string, unknown>): InvoiceRow {
  return {
    ...(row as unknown as InvoiceRow),
    subtotal_kobo: Number(row.subtotal_kobo),
    vat_rate: Number(row.vat_rate),
    vat_kobo: Number(row.vat_kobo),
    total_kobo: Number(row.total_kobo),
    amount_paid_kobo: Number(row.amount_paid_kobo),
    items: Array.isArray(row.items)
      ? (row.items as { description: string; amount_kobo: unknown }[]).map((i) => ({ description: i.description, amount_kobo: Number(i.amount_kobo) }))
      : [],
  }
}

export async function loadBillingSettings(): Promise<BillingSettings> {
  const { data } = await supabaseAdmin.from('firm_settings').select(SETTINGS_COLUMNS).eq('id', 1).maybeSingle()
  return {
    bank_account_name: data?.bank_account_name ?? null,
    bank_account_number: data?.bank_account_number ?? null,
    bank_name: data?.bank_name ?? null,
    vat_rate: data ? Number(data.vat_rate) : 0,
    tax_id: data?.tax_id ?? null,
    payment_terms_days: data?.payment_terms_days ?? 7,
    usd_ngn_rate: data?.usd_ngn_rate != null ? Number(data.usd_ngn_rate) : null,
  }
}

export async function caseRefFor(caseId: string | null): Promise<string | null> {
  if (!caseId) return null
  const { data } = await supabaseAdmin.from('cases').select('case_number, created_at').eq('id', caseId).maybeSingle()
  return data ? referenceFor(data.case_number, new Date(data.created_at)) : null
}

/** Re-derives amount paid and status from the payments table, so they can never drift. */
export async function recomputeInvoice(invoiceId: string): Promise<InvoiceRow | null> {
  const [{ data: inv }, { data: payments }] = await Promise.all([
    supabaseAdmin.from('invoices').select(INVOICE_COLUMNS).eq('id', invoiceId).maybeSingle(),
    supabaseAdmin.from('invoice_payments').select('amount_kobo').eq('invoice_id', invoiceId),
  ])
  if (!inv) return null
  const current = normaliseInvoice(inv)
  const paid = (payments || []).reduce((sum, p) => sum + Number(p.amount_kobo), 0)
  const status: InvoiceStatus = statusFromPayments(current.status, current.total_kobo, paid)
  const update: Record<string, unknown> = { amount_paid_kobo: paid, status, updated_at: new Date().toISOString() }
  if (status === 'paid' && !current.paid_at) update.paid_at = new Date().toISOString()
  if (status !== 'paid') update.paid_at = null
  const { data: saved } = await supabaseAdmin.from('invoices').update(update).eq('id', invoiceId).select(INVOICE_COLUMNS).single()
  return saved ? normaliseInvoice(saved) : null
}
