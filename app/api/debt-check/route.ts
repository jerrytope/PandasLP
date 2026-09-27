export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { LABELS, assessDebt, formatNairaPlain, normaliseNgPhone, parseAnswers } from '@/lib/debtCheck'
import { isValidEmail } from '@/lib/invoices'
import { recordConsent } from '@/lib/consentServer'

const RATE_LIMIT = 5
const RATE_WINDOW_MS = 10 * 60 * 1000

const VERDICT_LABEL = { strong: 'Very recoverable', good: 'Recoverable', possible: 'May be recoverable', difficult: 'Hard', review: 'Needs a lawyer first' } as const

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// A visitor who took the free debt check and asked a lawyer to contact them. The verdict is
// recomputed here from the answers, never taken from the browser.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`debt-check:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  }

  let body: { answers?: unknown; name?: unknown; phone?: unknown; email?: unknown; note?: unknown; consent?: unknown; marketingConsent?: unknown; pageUrl?: unknown; source?: unknown; sourceDetail?: unknown; website?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // Honeypot: a hidden field people never see. Bots fill it; pretend success and store nothing.
  if (typeof body.website === 'string' && body.website.trim()) return Response.json({ ok: true })

  const parsed = parseAnswers(body.answers)
  if ('error' in parsed) return Response.json({ error: parsed.error }, { status: 400 })
  const answers = parsed.answers

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 120) return Response.json({ error: 'Please add your name.' }, { status: 400 })
  const phone = typeof body.phone === 'string' ? normaliseNgPhone(body.phone) : null
  if (!phone) return Response.json({ error: 'Please add a Nigerian phone number, like 0803 123 4567.' }, { status: 400 })
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
  if (email && (email.length > 200 || !isValidEmail(email))) return Response.json({ error: 'That email address doesn’t look right.' }, { status: 400 })
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : null
  if (body.consent !== true) return Response.json({ error: 'Please tick the box so we can contact you.' }, { status: 400 })
  const marketingConsent = body.marketingConsent === true
  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl : null
  const userAgent = req.headers.get('user-agent')
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim().slice(0, 100) : null
  const sourceDetail = typeof body.sourceDetail === 'string' && body.sourceDetail.trim() ? body.sourceDetail.trim().slice(0, 500) : null

  const result = assessDebt(answers)

  const { data, error } = await supabaseAdmin
    .from('debt_checks')
    .insert({
      name,
      phone,
      email,
      answers,
      amount_naira: answers.amountNaira,
      verdict: result.verdict,
      next_step: result.nextStep,
      note,
      source,
      source_detail: sourceDetail,
      consent: true,
      marketing_consent: marketingConsent,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('Failed to save debt check:', error)
    return Response.json({ error: 'We couldn’t save your details. Please try again, or message us on WhatsApp.' }, { status: 500 })
  }

  // Proof of consent: one record per purpose, with the exact words shown. Marketing is only
  // recorded when its own box was ticked. A failure here is logged but doesn't lose the lead.
  const consentBase = { email, phone, source: 'debt_check', sourceId: data.id, pageUrl, userAgent }
  await recordConsent({ ...consentBase, version: 'matter_contact_v1', granted: true })
  if (marketingConsent) await recordConsent({ ...consentBase, version: 'marketing_v1', granted: true })

  // Staff are told straight away; a failed email must not lose the lead, which is already saved
  // and visible in the admin under Leads.
  if (isMailerConfigured()) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'
      const wa = `https://wa.me/${phone}`
      const rows: [string, string][] = [
        ['Owed by', LABELS.debtor[answers.debtor]],
        ['Amount', formatNairaPlain(answers.amountNaira)],
        ['Due', LABELS.age[answers.age]],
        ['Proof', answers.proof.map((p) => LABELS.proof[p]).join('; ')],
        ['Admitted?', LABELS.admission[answers.admission]],
        ['Can reach them?', LABELS.location[answers.location]],
        ['State', LABELS.state[answers.state]],
        ['Came from', source ?? 'direct / unknown'],
        ['Marketing', marketingConsent ? 'Opted in to tips and news' : 'Not opted in (contact about this debt only)'],
      ]
      await sendMail({
        to: GMAIL_USER,
        replyTo: email ?? undefined,
        subject: `New debt check lead: ${name}, ${formatNairaPlain(answers.amountNaira)} (${VERDICT_LABEL[result.verdict]})`,
        text: [
          `${name} took the free debt check and wants a lawyer to contact them.`,
          `Phone / WhatsApp: +${phone} (${wa})${email ? `\nEmail: ${email}` : ''}`,
          `Result shown: ${result.headline}`,
          '',
          ...rows.map(([k, v]) => `${k}: ${v}`),
          note ? `\nTheir note: ${note}` : '',
          '',
          `Open Leads in the admin: ${siteUrl}/admin`,
        ].join('\n'),
        html: `
          <p><strong>${escapeHtml(name)}</strong> took the free debt check and wants a lawyer to contact them.</p>
          <p>Phone / WhatsApp: <a href="${wa}">+${phone}</a>${email ? `<br>Email: ${escapeHtml(email)}` : ''}</p>
          <p>Result shown: <strong>${escapeHtml(result.headline)}</strong></p>
          <table cellpadding="4" style="border-collapse:collapse;font-size:14px">${rows
            .map(([k, v]) => `<tr><td style="color:#6B6B6B">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
            .join('')}</table>
          ${note ? `<p style="white-space:pre-wrap">Their note: ${escapeHtml(note)}</p>` : ''}
          <p><a href="${siteUrl}/admin">Open Leads in the admin</a></p>
        `,
      })
      await supabaseAdmin.from('debt_checks').update({ notified: true }).eq('id', data.id)
    } catch (err) {
      console.error('Debt check saved but notification email failed:', err)
    }
  }

  return Response.json({ ok: true })
}
