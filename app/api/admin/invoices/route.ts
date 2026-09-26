export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { lagosToday } from '@/lib/negotiationStatus'
import { addDaysYmd, computeTotals, isValidEmail, validateItems, INVOICE_STATUSES, type InvoiceStatus } from '@/lib/invoices'
import { INVOICE_COLUMNS, caseRefFor, loadBillingSettings, normaliseInvoice } from '@/lib/billing'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const RATE_WINDOW_MS = 10 * 60 * 1000

// GET  ?id=…            one invoice with its payments and the case reference
// GET  ?caseId=…        a case's invoices
// GET  ?status=…        invoices in a status (default: all), newest first
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const params = new URL(req.url).searchParams

  const id = params.get('id')
  if (id) {
    const { data, error } = await supabaseAdmin.from('invoices').select(INVOICE_COLUMNS).eq('id', id).maybeSingle()
    if (error || !data) return Response.json({ error: 'Invoice not found.' }, { status: 404 })
    const invoice = normaliseInvoice(data)
    const { data: payments } = await supabaseAdmin
      .from('invoice_payments')
      .select('id, amount_kobo, paid_on, method, reference, recorded_by, created_at')
      .eq('invoice_id', id)
      .order('paid_on', { ascending: true })
    return Response.json({
      invoice,
      payments: (payments || []).map((p) => ({ ...p, amount_kobo: Number(p.amount_kobo) })),
      caseRef: await caseRefFor(invoice.case_id),
    })
  }

  let query = supabaseAdmin.from('invoices').select(INVOICE_COLUMNS).order('created_at', { ascending: false }).limit(300)
  const caseId = params.get('caseId')
  if (caseId) query = query.eq('case_id', caseId)
  const status = params.get('status')
  if (status && (INVOICE_STATUSES as readonly string[]).includes(status)) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('Failed to list invoices:', error)
    return Response.json({ error: `Could not load invoices. (${error.message})` }, { status: 500 })
  }
  return Response.json({ invoices: (data || []).map(normaliseInvoice) })
}

type InvoiceBody = {
  id?: string
  caseId?: string | null
  clientName?: string
  clientEmail?: string | null
  matter?: string | null
  items?: unknown
  vatRate?: number
  issueDate?: string
  dueDate?: string | null
  notes?: string | null
  invoiceNumber?: string
  action?: 'void'
  voidReason?: string
}

function validateCommon(body: InvoiceBody): string | null {
  if (body.clientEmail && !isValidEmail(body.clientEmail.trim())) return 'The client email address is not valid.'
  if (body.issueDate && !YMD.test(body.issueDate)) return 'The invoice date must be a date.'
  if (body.dueDate && !YMD.test(body.dueDate)) return 'The due date must be a date.'
  if (body.issueDate && body.dueDate && body.dueDate < body.issueDate) return 'The due date cannot be before the invoice date.'
  if (body.vatRate !== undefined && (!Number.isFinite(body.vatRate) || body.vatRate < 0 || body.vatRate > 100)) return 'VAT must be between 0 and 100 per cent.'
  return null
}

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-invoices:${getClientIp(req)}`, 40, RATE_WINDOW_MS)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: InvoiceBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const clientName = (body.clientName || '').trim()
  if (!clientName) return Response.json({ error: 'Who is the invoice for? Add the client’s name.' }, { status: 400 })
  const commonError = validateCommon(body)
  if (commonError) return Response.json({ error: commonError }, { status: 400 })
  const itemsResult = validateItems(body.items)
  if ('error' in itemsResult) return Response.json({ error: itemsResult.error }, { status: 400 })

  if (body.caseId) {
    const { data: c } = await supabaseAdmin.from('cases').select('id').eq('id', body.caseId).maybeSingle()
    if (!c) return Response.json({ error: 'Case not found.' }, { status: 404 })
  }
  // Back-recording an invoice already issued by hand keeps its original number.
  const invoiceNumber = body.invoiceNumber?.trim()
  if (invoiceNumber && !/^[A-Z0-9][A-Z0-9/\-]{2,39}$/i.test(invoiceNumber)) {
    return Response.json({ error: 'The invoice number can only contain letters, numbers, "/" and "-".' }, { status: 400 })
  }

  const settings = await loadBillingSettings()
  const vatRate = body.vatRate ?? settings.vat_rate
  const issueDate = body.issueDate || lagosToday()
  const dueDate = body.dueDate === null ? null : body.dueDate || addDaysYmd(issueDate, settings.payment_terms_days)
  const totals = computeTotals(itemsResult.items, vatRate)

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .insert({
      ...(invoiceNumber ? { invoice_number: invoiceNumber } : {}),
      case_id: body.caseId || null,
      client_name: clientName,
      client_email: body.clientEmail?.trim() || null,
      matter: body.matter?.trim() || null,
      items: itemsResult.items,
      vat_rate: vatRate,
      ...totals,
      issue_date: issueDate,
      due_date: dueDate,
      notes: body.notes?.trim() || null,
      created_by: authResult.user.email ?? 'unknown',
    })
    .select(INVOICE_COLUMNS)
    .single()

  if (error || !data) {
    const duplicate = error?.code === '23505'
    console.error('Failed to create invoice:', error)
    return Response.json(
      { error: duplicate ? 'That invoice number is already used.' : `Could not create the invoice.${error ? ` (${error.message})` : ''}` },
      { status: duplicate ? 409 : 500 },
    )
  }
  return Response.json({ ok: true, invoice: normaliseInvoice(data) })
}

// Edit a draft, or void an invoice. Sent invoices are not edited in place: void and reissue,
// so the client never holds a document that no longer matches the firm's records.
export async function PATCH(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-invoices-patch:${getClientIp(req)}`, 60, RATE_WINDOW_MS)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: InvoiceBody
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.id) return Response.json({ error: 'Missing id.' }, { status: 400 })

  const { data: existing } = await supabaseAdmin.from('invoices').select(INVOICE_COLUMNS).eq('id', body.id).maybeSingle()
  if (!existing) return Response.json({ error: 'Invoice not found.' }, { status: 404 })
  const current = normaliseInvoice(existing)

  if (body.action === 'void') {
    if (current.status === 'void') return Response.json({ error: 'This invoice is already void.' }, { status: 409 })
    if (current.amount_paid_kobo > 0) {
      return Response.json({ error: 'Remove its payments before voiding an invoice that has been paid.' }, { status: 409 })
    }
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .update({ status: 'void' as InvoiceStatus, voided_at: new Date().toISOString(), void_reason: body.voidReason?.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .select(INVOICE_COLUMNS)
      .single()
    if (error || !data) return Response.json({ error: `Could not void the invoice.${error ? ` (${error.message})` : ''}` }, { status: 500 })
    return Response.json({ ok: true, invoice: normaliseInvoice(data) })
  }

  if (current.status !== 'draft') {
    return Response.json({ error: 'Only draft invoices can be edited. Void it and issue a new one instead.' }, { status: 409 })
  }
  const commonError = validateCommon(body)
  if (commonError) return Response.json({ error: commonError }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.clientName !== undefined) {
    const name = body.clientName.trim()
    if (!name) return Response.json({ error: 'The client’s name cannot be empty.' }, { status: 400 })
    update.client_name = name
  }
  if (body.clientEmail !== undefined) update.client_email = body.clientEmail?.trim() || null
  if (body.matter !== undefined) update.matter = body.matter?.trim() || null
  if (body.notes !== undefined) update.notes = body.notes?.trim() || null
  if (body.issueDate !== undefined) update.issue_date = body.issueDate
  if (body.dueDate !== undefined) update.due_date = body.dueDate || null
  const effectiveIssue = (update.issue_date as string | undefined) ?? current.issue_date
  const effectiveDue = body.dueDate !== undefined ? (update.due_date as string | null) : current.due_date
  if (effectiveDue && effectiveDue < effectiveIssue) {
    return Response.json({ error: 'The due date cannot be before the invoice date.' }, { status: 400 })
  }

  const items = body.items !== undefined ? validateItems(body.items) : { ok: true as const, items: current.items }
  if ('error' in items) return Response.json({ error: items.error }, { status: 400 })
  const vatRate = body.vatRate ?? current.vat_rate
  if (body.items !== undefined || body.vatRate !== undefined) {
    Object.assign(update, { items: items.items, vat_rate: vatRate, ...computeTotals(items.items, vatRate) })
  }

  const { data, error } = await supabaseAdmin.from('invoices').update(update).eq('id', body.id).select(INVOICE_COLUMNS).single()
  if (error || !data) return Response.json({ error: `Could not save the invoice.${error ? ` (${error.message})` : ''}` }, { status: 500 })
  return Response.json({ ok: true, invoice: normaliseInvoice(data) })
}
