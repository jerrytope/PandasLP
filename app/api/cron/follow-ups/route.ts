export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendCaseEmail } from '@/lib/sendCaseEmail'
import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'
import { lagosToday, NEGOTIATION_STATUS_LABEL, isNegotiationStatus } from '@/lib/negotiationStatus'

const DAY_MS = 24 * 60 * 60 * 1000
const RESPONSE_PERIOD_DAYS = 14

// Vercel Cron calls this on a schedule (see vercel.json) with an
// `Authorization: Bearer $CRON_SECRET` header it sets automatically from the env var of the
// same name — this is the only auth check available since there's no user session for a
// scheduled job. Without this route, "Day 7 / Day 14 follow-up" was only ever a manual
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

  const negotiationReminders = await sendNegotiationReminders()

  return Response.json({ ok: true, checked: cases?.length ?? 0, sent: results, negotiationReminders })
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// One morning email to staff listing every negotiation next action that is due today or
// overdue and hasn't been reminded about today. Rows are stamped with reminder_sent_at only
// after the email actually sends, so a failed send is retried on the next run.
async function sendNegotiationReminders(): Promise<{ due: number; emailed: boolean; error?: string }> {
  const today = lagosToday()

  const { data, error } = await supabaseAdmin
    .from('case_negotiations')
    .select('id, case_id, status, next_action, next_action_due, reminder_sent_at, cases!inner(document_title, case_number, is_test)')
    .not('next_action', 'is', null)
    .is('next_action_done_at', null)
    .lte('next_action_due', today)
    .eq('cases.is_test', false)
    .order('next_action_due', { ascending: true })

  if (error) {
    console.error('Failed to load due negotiation actions:', error)
    return { due: 0, emailed: false, error: error.message }
  }

  const due = (data || []).filter((r) => !r.reminder_sent_at || lagosToday(new Date(r.reminder_sent_at)) !== today)
  if (due.length === 0) return { due: 0, emailed: false }
  if (!isMailerConfigured()) return { due: due.length, emailed: false, error: 'Mailer not configured.' }

  const recipients = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? GMAIL_USER)
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .join(', ')

  const lines = due.map((r) => {
    const c = (Array.isArray(r.cases) ? r.cases[0] : r.cases) as { document_title: string | null; case_number: number | null } | null
    const title = c?.document_title || 'Untitled case'
    const ref = c?.case_number != null ? `#${c.case_number} ` : ''
    const when = r.next_action_due < today ? `OVERDUE since ${r.next_action_due}` : 'due today'
    const status = isNegotiationStatus(r.status) ? NEGOTIATION_STATUS_LABEL[r.status] : ''
    return { title: `${ref}${title}`, action: r.next_action as string, when, status }
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'
  const text = [
    `Negotiation follow-ups for ${today}:`,
    '',
    ...lines.map((l) => `- ${l.title}: ${l.action} (${l.when}${l.status ? `, ${l.status}` : ''})`),
    '',
    `Open the admin queue: ${siteUrl}/admin`,
  ].join('\n')
  const html = `<p>Negotiation follow-ups for <strong>${today}</strong>:</p><ul>${lines
    .map(
      (l) =>
        `<li><strong>${escapeHtml(l.title)}</strong>: ${escapeHtml(l.action)} <em>(${escapeHtml(l.when)}${
          l.status ? `, ${escapeHtml(l.status)}` : ''
        })</em></li>`,
    )
    .join('')}</ul><p><a href="${siteUrl}/admin">Open the admin queue</a></p>`

  try {
    await sendMail({
      to: recipients,
      subject: `${due.length} negotiation follow-up${due.length === 1 ? '' : 's'} due | Pandas LP`,
      text,
      html,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to send negotiation reminder email:', err)
    return { due: due.length, emailed: false, error: message }
  }

  await supabaseAdmin
    .from('case_negotiations')
    .update({ reminder_sent_at: new Date().toISOString() })
    .in('id', due.map((r) => r.id))

  return { due: due.length, emailed: true }
}
