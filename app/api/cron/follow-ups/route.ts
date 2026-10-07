export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendCaseEmail } from '@/lib/sendCaseEmail'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { lagosToday, NEGOTIATION_STATUS_LABEL, isNegotiationStatus } from '@/lib/negotiationStatus'
import { formatKobo } from '@/lib/money'

const DAY_MS = 24 * 60 * 60 * 1000
const RESPONSE_PERIOD_DAYS = 14

// The scheduler calls this daily (see scripts/run-scheduled-job.mjs for the schedule and how to
// call it) with an `Authorization: Bearer $CRON_SECRET` header — the only auth check available,
// since there's no user session for a scheduled job. Without this route, "Day 7 / Day 14 follow-up" was only ever a manual
// per-case button; nothing actually watched the clock.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET not configured.' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { data: cases, error } = await supabaseAdmin
    .from('cases')
    .select('id, deadline_at, email_day7_sent, email_day14_sent')
    .eq('status', 'letter_served')
    // Brand borrowers get their own reminders (lib/brandServing.ts), sent to the borrower.
    .is('brand_id', null)
    .or('email_day7_sent.eq.false,email_day14_sent.eq.false')

  if (error) {
    return Response.json({ error: 'Failed to query cases.' }, { status: 500 })
  }

  const results: { caseId: string; day: 7 | 14; ok: boolean; error?: string }[] = []

  for (const c of cases ?? []) {
    if (!c.deadline_at) continue
    // deadline_at is set to servedAt + 14 days when the case is marked served (see
    // app/api/update-case-status/route.ts) — there's no separate servedAt column, so this
    // is how far back we reconstruct it.
    const servedAt = new Date(c.deadline_at).getTime() - RESPONSE_PERIOD_DAYS * DAY_MS
    const daysSinceServed = Math.floor((Date.now() - servedAt) / DAY_MS)

    if (daysSinceServed >= 7 && !c.email_day7_sent) {
      const result = await sendCaseEmail(c.id, { type: 'follow_up', day: 7 })
      results.push({ caseId: c.id, day: 7, ok: result.ok, error: result.ok === false ? result.error : undefined })
    }
    if (daysSinceServed >= 14 && !c.email_day14_sent) {
      const result = await sendCaseEmail(c.id, { type: 'follow_up', day: 14 })
      results.push({ caseId: c.id, day: 14, ok: result.ok, error: result.ok === false ? result.error : undefined })
    }
  }

  const digest = await sendMorningDigest()

  return Response.json({ ok: true, checked: cases?.length ?? 0, sent: results, digest })
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type DigestLine = { title: string; detail: string; when: string }

// One morning email to staff with everything that needs chasing today:
//   - negotiation next actions due today or overdue, each included once per day (rows are
//     stamped with reminder_sent_at only after the email actually sends, so a failed send is
//     retried on the next run);
//   - sent invoices past their due date with a balance still owing, listed every day until
//     they are paid or voided.
async function sendMorningDigest(): Promise<{ negotiations: number; invoices: number; emailed: boolean; error?: string }> {
  const today = lagosToday()

  const [negRes, invRes] = await Promise.all([
    supabaseAdmin
      .from('case_negotiations')
      .select('id, case_id, status, next_action, next_action_due, reminder_sent_at, cases!inner(document_title, case_number, is_test)')
      .not('next_action', 'is', null)
      .is('next_action_done_at', null)
      .lte('next_action_due', today)
      .eq('cases.is_test', false)
      .order('next_action_due', { ascending: true }),
    supabaseAdmin
      .from('invoices')
      .select('id, invoice_number, client_name, total_kobo, amount_paid_kobo, due_date')
      .in('status', ['sent', 'part_paid'])
      .lt('due_date', today)
      .order('due_date', { ascending: true }),
  ])
  if (negRes.error) console.error('Failed to load due negotiation actions:', negRes.error)
  if (invRes.error) console.error('Failed to load overdue invoices:', invRes.error)

  const dueNegotiations = (negRes.data || []).filter((r) => !r.reminder_sent_at || lagosToday(new Date(r.reminder_sent_at)) !== today)
  const overdueInvoices = invRes.data || []
  const counts = { negotiations: dueNegotiations.length, invoices: overdueInvoices.length }
  if (counts.negotiations === 0 && counts.invoices === 0) return { ...counts, emailed: false }
  if (!isMailerConfigured()) return { ...counts, emailed: false, error: 'Mailer not configured.' }

  const negotiationLines: DigestLine[] = dueNegotiations.map((r) => {
    const c = (Array.isArray(r.cases) ? r.cases[0] : r.cases) as { document_title: string | null; case_number: number | null } | null
    const status = isNegotiationStatus(r.status) ? `, ${NEGOTIATION_STATUS_LABEL[r.status]}` : ''
    return {
      title: `${c?.case_number != null ? `#${c.case_number} ` : ''}${c?.document_title || 'Untitled case'}`,
      detail: r.next_action as string,
      when: `${r.next_action_due < today ? `OVERDUE since ${r.next_action_due}` : 'due today'}${status}`,
    }
  })
  const invoiceLines: DigestLine[] = overdueInvoices.map((i) => ({
    title: `${i.invoice_number} · ${i.client_name}`,
    detail: `${formatKobo(Math.max(0, Number(i.total_kobo) - Number(i.amount_paid_kobo)))} outstanding`,
    when: `due ${i.due_date}`,
  }))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'
  const section = (heading: string, lines: DigestLine[]) =>
    lines.length === 0
      ? { text: '', html: '' }
      : {
          text: [`${heading}:`, ...lines.map((l) => `- ${l.title}: ${l.detail} (${l.when})`), ''].join('\n'),
          html: `<p><strong>${escapeHtml(heading)}</strong></p><ul>${lines
            .map((l) => `<li><strong>${escapeHtml(l.title)}</strong>: ${escapeHtml(l.detail)} <em>(${escapeHtml(l.when)})</em></li>`)
            .join('')}</ul>`,
        }
  const neg = section('Negotiation follow-ups', negotiationLines)
  const inv = section('Overdue invoices', invoiceLines)
  const subjectParts = [
    counts.negotiations ? `${counts.negotiations} follow-up${counts.negotiations === 1 ? '' : 's'} due` : '',
    counts.invoices ? `${counts.invoices} invoice${counts.invoices === 1 ? '' : 's'} overdue` : '',
  ].filter(Boolean)

  const recipients = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? GMAIL_USER)
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .join(', ')

  try {
    await sendMail({
      to: recipients,
      subject: `${subjectParts.join(', ')} | Pandas LP`,
      text: [`Morning digest for ${today}`, '', neg.text, inv.text, `Open the admin: ${siteUrl}/admin`].filter((p) => p !== '').join('\n'),
      html: `<p>Morning digest for <strong>${today}</strong></p>${neg.html}${inv.html}<p><a href="${siteUrl}/admin">Open the admin</a></p>`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to send morning digest:', err)
    return { ...counts, emailed: false, error: message }
  }

  if (dueNegotiations.length) {
    await supabaseAdmin
      .from('case_negotiations')
      .update({ reminder_sent_at: new Date().toISOString() })
      .in('id', dueNegotiations.map((r) => r.id))
  }
  return { ...counts, emailed: true }
}
