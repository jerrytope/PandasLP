export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { getInvoiceEmail } from '@/lib/emailTemplates'
import { buildInvoicePdfBuffer } from '@/lib/pdfGenerator.js'
import { balanceKobo, hasBankDetails } from '@/lib/invoices'
import { formatKobo } from '@/lib/money'
import { INVOICE_COLUMNS, caseRefFor, loadBillingSettings, normaliseInvoice } from '@/lib/billing'

function longDate(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// Emails the invoice to the client with the letterhead PDF attached, and marks a draft as sent.
// Sending again resends the current version; a paid invoice goes out as a receipt.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-invoice-send:${getClientIp(req)}`, 15, 10 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.id) return Response.json({ error: 'Missing id.' }, { status: 400 })

  const { data } = await supabaseAdmin.from('invoices').select(INVOICE_COLUMNS).eq('id', body.id).maybeSingle()
  if (!data) return Response.json({ error: 'Invoice not found.' }, { status: 404 })
  const invoice = normaliseInvoice(data)

  if (invoice.status === 'void') return Response.json({ error: 'A void invoice cannot be sent.' }, { status: 409 })
  if (!invoice.client_email) return Response.json({ error: 'Add the client’s email address to the invoice first.' }, { status: 409 })
  if (!isMailerConfigured()) return Response.json({ error: 'Email is not configured on the server.' }, { status: 503 })

  const settings = await loadBillingSettings()
  const paid = invoice.status === 'paid'
  if (!paid && !hasBankDetails(settings)) {
    return Response.json({ error: 'Add the firm’s bank details in Finance → Settings before sending an invoice.' }, { status: 409 })
  }

  const pdf = buildInvoicePdfBuffer(invoice, settings, { caseRef: await caseRefFor(invoice.case_id) })
  const email = getInvoiceEmail({
    clientName: invoice.client_name,
    invoiceNumber: invoice.invoice_number,
    matter: invoice.matter,
    totalText: formatKobo(invoice.total_kobo),
    balanceText: formatKobo(balanceKobo(invoice)),
    dueText: invoice.due_date ? `due by ${longDate(invoice.due_date)}` : 'due on receipt',
    paid,
  })

  try {
    await sendMail({
      to: invoice.client_email,
      replyTo: GMAIL_USER,
      subject: email.subject,
      text: email.text,
      html: email.html,
      attachments: [{ filename: `${invoice.invoice_number.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`, content: pdf, contentType: 'application/pdf' }],
    })
  } catch (err) {
    console.error('Failed to email invoice:', err)
    return Response.json({ error: `The email did not send: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 502 })
  }

  const now = new Date().toISOString()
  const update: Record<string, unknown> = { sent_at: now, updated_at: now }
  if (invoice.status === 'draft') update.status = 'sent'
  const { data: saved } = await supabaseAdmin.from('invoices').update(update).eq('id', invoice.id).select(INVOICE_COLUMNS).single()
  return Response.json({ ok: true, invoice: saved ? normaliseInvoice(saved) : invoice })
}
