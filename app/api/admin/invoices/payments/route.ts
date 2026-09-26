export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { lagosToday } from '@/lib/negotiationStatus'
import { PAYMENT_METHODS, balanceKobo } from '@/lib/invoices'
import { INVOICE_COLUMNS, normaliseInvoice, recomputeInvoice } from '@/lib/billing'

// Record a payment against an invoice (POST) or remove one entered by mistake (DELETE). The
// invoice's amount paid and status are always re-derived from the payments table afterwards
// (lib/billing.ts recomputeInvoice), so they can never drift from the payments recorded.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-invoice-payments:${getClientIp(req)}`, 40, 10 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { invoiceId?: string; amountKobo?: number; paidOn?: string; method?: string; reference?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.invoiceId) return Response.json({ error: 'Missing invoiceId.' }, { status: 400 })
  if (!Number.isInteger(body.amountKobo) || (body.amountKobo as number) <= 0) {
    return Response.json({ error: 'Enter the amount received.' }, { status: 400 })
  }
  const paidOn = body.paidOn || lagosToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || paidOn > lagosToday()) {
    return Response.json({ error: 'The payment date must be today or earlier.' }, { status: 400 })
  }
  const method = body.method && (PAYMENT_METHODS as readonly string[]).includes(body.method) ? body.method : 'bank_transfer'

  const { data } = await supabaseAdmin.from('invoices').select(INVOICE_COLUMNS).eq('id', body.invoiceId).maybeSingle()
  if (!data) return Response.json({ error: 'Invoice not found.' }, { status: 404 })
  const invoice = normaliseInvoice(data)
  if (invoice.status === 'void') return Response.json({ error: 'Payments cannot be recorded on a void invoice.' }, { status: 409 })
  if (invoice.status === 'draft') return Response.json({ error: 'Send the invoice before recording payments against it.' }, { status: 409 })
  if ((body.amountKobo as number) > balanceKobo(invoice)) {
    return Response.json({ error: 'That is more than the balance due on this invoice.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('invoice_payments').insert({
    invoice_id: invoice.id,
    amount_kobo: body.amountKobo,
    paid_on: paidOn,
    method,
    reference: body.reference?.trim().slice(0, 120) || null,
    recorded_by: authResult.user.email ?? 'unknown',
  })
  if (error) {
    console.error('Failed to record payment:', error)
    return Response.json({ error: `Could not record the payment. (${error.message})` }, { status: 500 })
  }
  return Response.json({ ok: true, invoice: await recomputeInvoice(invoice.id) })
}

export async function DELETE(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  let body: { paymentId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.paymentId) return Response.json({ error: 'Missing paymentId.' }, { status: 400 })

  const { data: payment } = await supabaseAdmin.from('invoice_payments').select('id, invoice_id').eq('id', body.paymentId).maybeSingle()
  if (!payment) return Response.json({ error: 'Payment not found.' }, { status: 404 })
  const { error } = await supabaseAdmin.from('invoice_payments').delete().eq('id', payment.id)
  if (error) return Response.json({ error: `Could not remove the payment. (${error.message})` }, { status: 500 })
  return Response.json({ ok: true, invoice: await recomputeInvoice(payment.invoice_id) })
}
