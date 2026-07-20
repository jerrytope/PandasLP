export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendCaseEmail } from '@/lib/sendCaseEmail'

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

  return Response.json({ ok: true, checked: cases?.length ?? 0, sent: results })
}
