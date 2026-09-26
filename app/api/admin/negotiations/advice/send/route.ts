export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { sendCaseEmail } from '@/lib/sendCaseEmail'

// Saves the lawyer's final advice note on the response it answers, emails it to our client,
// and records when it went. The note is saved first, so a failed send keeps the edited text
// and can simply be retried.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-negotiation-advice-send:${getClientIp(req)}`, 10, 10 * 60 * 1000)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { negotiationId?: string; adviceNote?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const adviceNote = (body.adviceNote || '').trim()
  if (!body.negotiationId || !adviceNote) {
    return Response.json({ error: 'Missing negotiationId or advice note.' }, { status: 400 })
  }

  const { data: round, error: roundErr } = await supabaseAdmin
    .from('case_negotiations')
    .update({ advice_note: adviceNote })
    .eq('id', body.negotiationId)
    .eq('party', 'debtor_counsel')
    .select('id, case_id')
    .single()
  if (roundErr || !round) {
    console.error('Failed to save advice note:', roundErr)
    return Response.json({ error: `Could not save the advice note.${roundErr ? ` (${roundErr.message})` : ''}` }, { status: 500 })
  }

  const result = await sendCaseEmail(round.case_id, { type: 'negotiation_advice', negotiationId: round.id })
  if (result.ok === false) {
    return Response.json({ error: `Saved, but the email did not send: ${result.error}` }, { status: result.status })
  }

  const sentAt = new Date().toISOString()
  await supabaseAdmin.from('case_negotiations').update({ advice_sent_at: sentAt }).eq('id', round.id)
  return Response.json({ ok: true, adviceSentAt: sentAt })
}
