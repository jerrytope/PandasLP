export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { sendCaseEmail } from '@/lib/sendCaseEmail'
import { defaultStatusFor, isDueDate, isNegotiationStatus } from '@/lib/negotiationStatus'

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 5 * 60 * 1000
const MAX_FILE_BYTES = 10 * 1024 * 1024
const BUCKET = 'case-documents'

const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

// One round of the negotiation thread for a case — either a counter/reply received from the
// debtor's own lawyer, or our reply back to them. See supabase-schema.sql's case_negotiations
// comment for why this is a thread, not a single status.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-negotiations:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const loggedBy = authResult.user.email || 'unknown'

  let body: {
    caseId?: string
    party?: 'debtor_counsel' | 'pandas_lp'
    counselName?: string
    proposedAmount?: number | string
    summary?: string
    occurredAt?: string
    aiDrafted?: boolean
    attachmentBase64?: string
    attachmentType?: string
    status?: string
    nextAction?: string
    nextActionDue?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, party, attachmentBase64, attachmentType } = body
  const nextAction = (body.nextAction || '').trim()
  const nextActionDue = (body.nextActionDue || '').trim()
  const summary = (body.summary || '').trim()
  const counselName = (body.counselName || '').trim()

  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }
  if (party !== 'debtor_counsel' && party !== 'pandas_lp') {
    return Response.json({ error: 'party must be "debtor_counsel" or "pandas_lp".' }, { status: 400 })
  }
  if (!summary) {
    return Response.json({ error: 'A summary of what was said or offered is required.' }, { status: 400 })
  }
  if (body.status !== undefined && body.status !== '' && !isNegotiationStatus(body.status)) {
    return Response.json({ error: 'Unknown negotiation status.' }, { status: 400 })
  }
  if (nextActionDue && !isDueDate(nextActionDue)) {
    return Response.json({ error: 'The due date must be a real date (YYYY-MM-DD).' }, { status: 400 })
  }
  if (nextActionDue && !nextAction) {
    return Response.json({ error: 'Say what the next action is, or clear the due date.' }, { status: 400 })
  }
  const status = isNegotiationStatus(body.status) ? body.status : defaultStatusFor(party)

  let proposedAmount: number | null = null
  if (body.proposedAmount !== undefined && body.proposedAmount !== '') {
    const n = Number(body.proposedAmount)
    if (!Number.isFinite(n) || n < 0) {
      return Response.json({ error: 'proposedAmount must be a non-negative number.' }, { status: 400 })
    }
    proposedAmount = n
  }

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }

  // A new round supersedes whatever the previous one was waiting on: their reply arriving
  // answers "awaiting their reply", and our reply going out answers "respond to their counter".
  // Closing those here keeps the dashboard's follow-up list to what is actually still open.
  const { error: closeErr } = await supabaseAdmin
    .from('case_negotiations')
    .update({ next_action_done_at: new Date().toISOString() })
    .eq('case_id', caseId)
    .is('next_action_done_at', null)
    .not('next_action', 'is', null)
  if (closeErr) console.error('Failed to close superseded negotiation actions:', closeErr)

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('case_negotiations')
    .insert({
      status,
      next_action: nextAction || null,
      next_action_due: nextAction && nextActionDue ? nextActionDue : null,
      case_id: caseId,
      party,
      counsel_name: party === 'debtor_counsel' && counselName ? counselName : null,
      proposed_amount: proposedAmount,
      summary,
      ai_drafted: party === 'pandas_lp' && body.aiDrafted === true,
      logged_by: loggedBy,
      occurred_at: body.occurredAt || new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('Failed to log negotiation round:', insertErr)
    return Response.json({ error: 'Could not save this entry.' }, { status: 500 })
  }

  // Optional scanned copy of the actual letter. After the insert and non-fatal for the same
  // reason as recoveries' proof upload: a logged round with a summary but no attachment is
  // still a valid record.
  let attachmentPath: string | null = null
  let attachmentWarning: string | null = null

  if (attachmentBase64) {
    const ext = EXT[attachmentType || '']
    if (!ext) {
      attachmentWarning = 'Entry saved, but the attachment was not stored: only PDF, PNG and JPEG are accepted.'
    } else if (Math.ceil((attachmentBase64.length * 3) / 4) > MAX_FILE_BYTES) {
      attachmentWarning = 'Entry saved, but the attachment was not stored: maximum size is 10 MB.'
    } else {
      const path = `negotiations/${inserted.id}.${ext}`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, Buffer.from(attachmentBase64, 'base64'), { contentType: attachmentType, upsert: true })
      if (uploadErr) {
        console.error('Failed to upload negotiation attachment:', uploadErr)
        attachmentWarning = 'Entry saved, but the attachment could not be uploaded.'
      } else {
        attachmentPath = path
        await supabaseAdmin.from('case_negotiations').update({ attachment_path: path }).eq('id', inserted.id)
      }
    }
  }

  // Keeps the client in the loop the moment we reply on their behalf — fire-and-forget, same
  // reasoning as every other client email in this app: an already-saved negotiation round
  // must never fail or roll back because the notification email had trouble sending.
  if (party === 'pandas_lp') {
    sendCaseEmail(caseId, { type: 'negotiation_reply', negotiationId: inserted.id }).catch((err) =>
      console.error('Failed to send negotiation-reply email:', err),
    )
  }

  return Response.json({ ok: true, id: inserted.id, attachmentPath, warning: attachmentWarning })
}

// The full thread for one case, oldest first — read top to bottom like a real correspondence.
export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-negotiations-get:${getClientIp(req)}`, 60, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const caseId = new URL(req.url).searchParams.get('caseId')
  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('case_negotiations')
    .select('id, party, counsel_name, proposed_amount, summary, attachment_path, ai_drafted, logged_by, occurred_at, status, next_action, next_action_due, next_action_done_at, advice_note, advice_sent_at, client_instructions, instructions_received_at')
    .eq('case_id', caseId)
    .order('occurred_at', { ascending: true })

  if (error) {
    console.error('Failed to load negotiation thread:', error)
    return Response.json({ error: 'Could not load the negotiation thread.' }, { status: 500 })
  }

  // Short-lived signed URLs so an attached scan is viewable without making the bucket public —
  // same pattern as recoveries' proof_path.
  const rounds = await Promise.all(
    (data || []).map(async (r) => {
      if (!r.attachment_path) return { ...r, attachmentUrl: null }
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(r.attachment_path, 60 * 10)
      return { ...r, attachmentUrl: signed?.signedUrl ?? null }
    }),
  )

  return Response.json({ rounds })
}

// Updates where a round stands without rewriting what was said in it: change the status,
// reschedule or reword the next action, or mark it done. The summary, amount and attachment
// are the record of the correspondence and stay as logged.
export async function PATCH(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-negotiations-patch:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: {
    id?: string
    status?: string
    nextAction?: string | null
    nextActionDue?: string | null
    done?: boolean
    adviceNote?: string | null
    clientInstructions?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.id) {
    return Response.json({ error: 'Missing id.' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!isNegotiationStatus(body.status)) {
      return Response.json({ error: 'Unknown negotiation status.' }, { status: 400 })
    }
    update.status = body.status
  }
  if (body.nextAction !== undefined) {
    const text = (body.nextAction || '').trim()
    update.next_action = text || null
    // A reworded action is a new action: reopen it and let the reminder fire again.
    update.next_action_done_at = null
    update.reminder_sent_at = null
    if (!text) update.next_action_due = null
  }
  if (body.nextActionDue !== undefined) {
    const due = (body.nextActionDue || '').trim()
    if (due && !isDueDate(due)) {
      return Response.json({ error: 'The due date must be a real date (YYYY-MM-DD).' }, { status: 400 })
    }
    update.next_action_due = due || null
    update.reminder_sent_at = null
  }
  // The advise-the-client step, recorded on the response it answers.
  if (body.adviceNote !== undefined) update.advice_note = (body.adviceNote || '').trim() || null
  if (body.clientInstructions !== undefined) {
    const text = (body.clientInstructions || '').trim()
    update.client_instructions = text || null
    update.instructions_received_at = text ? new Date().toISOString() : null
  }
  if (body.done === true) update.next_action_done_at = new Date().toISOString()
  if (body.done === false) update.next_action_done_at = null

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('case_negotiations')
    .update(update)
    .eq('id', body.id)
    .select('id, status, next_action, next_action_due, next_action_done_at, advice_note, advice_sent_at, client_instructions, instructions_received_at')
    .single()

  if (error || !data) {
    console.error('Failed to update negotiation round:', error)
    return Response.json({ error: `Could not update this entry.${error ? ` (${error.message})` : ''}` }, { status: 500 })
  }

  return Response.json({ ok: true, round: data })
}
