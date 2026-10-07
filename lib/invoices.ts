// Invoice rules, kept pure so they are unit-tested and shared by the API routes and the admin
// UI. Amounts are kobo integers (see lib/money.ts). Storage is public.invoices and
// public.invoice_payments (add-billing-and-ai-usage.sql).

import { vatOn } from './money'

export const INVOICE_STATUSES = ['draft', 'sent', 'part_paid', 'paid', 'void'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  part_paid: 'Part paid',
  paid: 'Paid',
  void: 'Void',
}

export const PAYMENT_METHODS = ['bank_transfer', 'cash', 'pos', 'paystack', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  pos: 'POS',
  paystack: 'Paystack',
  other: 'Other',
}

export interface InvoiceItem {
  description: string
  amount_kobo: number
}

export interface InvoiceRow {
  id: string
  invoice_number: string
  case_id: string | null
  client_name: string
  client_email: string | null
  matter: string | null
  items: InvoiceItem[]
  subtotal_kobo: number
  vat_rate: number
  vat_kobo: number
  total_kobo: number
  amount_paid_kobo: number
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  notes: string | null
  sent_at: string | null
  paid_at: string | null
  voided_at: string | null
  void_reason: string | null
  created_by: string
  created_at: string
}

export interface BillingSettings {
  bank_account_name: string | null
  bank_account_number: string | null
  bank_name: string | null
  vat_rate: number
  tax_id: string | null
  payment_terms_days: number
  usd_ngn_rate: number | null
}

// High enough for a brand's monthly invoice (one line per letter, lib/brandBilling.ts).
const MAX_ITEMS = 500
const MAX_LINE_KOBO = 100_000_000_000 // ₦1bn per line: a typo guard, not a business limit

export function validateItems(raw: unknown): { ok: true; items: InvoiceItem[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Add at least one line.' }
  if (raw.length > MAX_ITEMS) return { ok: false, error: `An invoice can have at most ${MAX_ITEMS} lines.` }
  const items: InvoiceItem[] = []
  for (const [i, line] of raw.entries()) {
    const description = typeof line?.description === 'string' ? line.description.trim() : ''
    const amount = line?.amount_kobo
    if (!description) return { ok: false, error: `Line ${i + 1} needs a description.` }
    if (description.length > 1000) return { ok: false, error: `Line ${i + 1}'s description is too long.` }
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_LINE_KOBO) {
      return { ok: false, error: `Line ${i + 1} needs an amount greater than zero.` }
    }
    items.push({ description, amount_kobo: amount })
  }
  return { ok: true, items }
}

export function computeTotals(items: InvoiceItem[], vatRate: number) {
  const subtotal = items.reduce((sum, i) => sum + i.amount_kobo, 0)
  const vat = vatOn(subtotal, vatRate)
  return { subtotal_kobo: subtotal, vat_kobo: vat, total_kobo: subtotal + vat }
}

/** Status once payments are known. Drafts and voided invoices keep their status. */
export function statusFromPayments(current: InvoiceStatus, totalKobo: number, paidKobo: number): InvoiceStatus {
  if (current === 'void' || current === 'draft') return current
  if (paidKobo >= totalKobo) return 'paid'
  if (paidKobo > 0) return 'part_paid'
  return 'sent'
}

export function balanceKobo(inv: Pick<InvoiceRow, 'total_kobo' | 'amount_paid_kobo'>): number {
  return Math.max(0, inv.total_kobo - inv.amount_paid_kobo)
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isOverdue(inv: Pick<InvoiceRow, 'status' | 'due_date'>, todayYmd: string): boolean {
  return (inv.status === 'sent' || inv.status === 'part_paid') && !!inv.due_date && inv.due_date < todayYmd
}

export function hasBankDetails(s: Pick<BillingSettings, 'bank_account_name' | 'bank_account_number' | 'bank_name'> | null): boolean {
  return !!(s?.bank_account_name?.trim() && s.bank_account_number?.trim() && s.bank_name?.trim())
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}
