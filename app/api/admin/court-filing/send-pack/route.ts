export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { getCourtPackEmailHtml } from '@/lib/emailTemplates'
import { buildCourtPackPdfBuffer } from '@/lib/courtFormPdf.js'
import { FIRM_WHATSAPP_URL, UPLOAD_LINK_PLACEHOLDER } from '@/lib/courtPackEmail'
import { uploadLinkUrl } from '@/lib/uploadLink'
import { packKinds, type DocKind } from '@/lib/courtFiling'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// E-mails the reviewed filing pack to the client as one PDF, with the covering instructions staff
// approved in the Court filing tab (what to sign, the passport photograph, scanning back, coming
// to the registry). Only saved versions are sent: the latest saved draft of each form chosen.
// A record of what went, to whom and when, is kept as a "client_email" document on the filing.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-court-send:${getClientIp(req)}`, 10, 10 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const by = authResult.user.email || 'unknown'

  let body: { caseId?: string; to?: string; subject?: string; message?: string; kinds?: string[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const to = body.to?.trim() ?? ''
  const subject = body.subject?.trim() ?? ''
  const message = body.message?.trim() ?? ''
  if (!body.caseId) return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  if (!EMAIL.test(to)) return Response.json({ error: 'Enter the client’s e-mail address.' }, { status: 400 })
  if (!subject || !message) return Response.json({ error: 'The e-mail needs a subject and a message.' }, { status: 400 })
  if (!isMailerConfigured()) return Response.json({ error: 'Email is not configured on the server.' }, { status: 503 })

  const { data: filing } = await supabaseAdmin.from('court_filings').select('id, state').eq('case_id', body.caseId).maybeSingle()
  if (!filing) return Response.json({ error: 'Draft the filing pack first.' }, { status: 409 })
  const allowedKinds = packKinds(filing.state)
  const kinds = (body.kinds ?? allowedKinds).filter((k): k is DocKind => allowedKinds.includes(k as DocKind))

  const { data: docs } = await supabaseAdmin
    .from('court_filing_documents')
    .select('kind, title, body, created_at')
    .eq('filing_id', filing.id)
    .in('kind', kinds)
    .order('created_at', { ascending: false })
  // Latest saved version of each form, in bundle order.
  const latest = kinds.map((k) => (docs ?? []).find((d: { kind: string }) => d.kind === k)).filter(Boolean) as { kind: string; title: string; body: string }[]
  if (!latest.length) return Response.json({ error: 'There are no drafted forms to send yet.' }, { status: 409 })

  const { data: c } = await supabaseAdmin.from('cases').select('case_number').eq('id', body.caseId).maybeSingle()
  const pdf = buildCourtPackPdfBuffer(latest.map((d) => d.body))
  // The client's private link for uploading the signed forms straight into the case.
  const uploadUrl = uploadLinkUrl(process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng', body.caseId)
  const finalText = message.split(UPLOAD_LINK_PLACEHOLDER).join(uploadUrl)
  try {
    await sendMail({
      to,
      replyTo: GMAIL_USER,
      subject,
      text: finalText,
      html: getCourtPackEmailHtml(finalText, FIRM_WHATSAPP_URL, uploadUrl),
      attachments: [{ filename: `Court-papers-case-${c?.case_number ?? ''}.pdf`.replace('--', '-'), content: pdf, contentType: 'application/pdf' }],
    })
  } catch (err) {
    console.error('Failed to email the filing pack:', err)
    return Response.json({ error: `The email did not send: ${err instanceof Error ? err.message : 'unknown error'}` }, { status: 502 })
  }

  const record = `To: ${to}\nSubject: ${subject}\nAttached: ${latest.map((d) => d.title).join('; ')}\n\n${message}`
  await supabaseAdmin.from('court_filing_documents').insert({ filing_id: filing.id, kind: 'client_email', title: `Filing pack e-mailed to ${to}`, body: record, ai_generated: false, created_by: by })
  return Response.json({ ok: true, sent: latest.length })
}
