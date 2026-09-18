export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

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
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, party, attachmentBase64, attachmentType } = body
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

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('case_negotiations')
    .insert({
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
    .select('id, party, counsel_name, proposed_amount, summary, attachment_path, ai_drafted, logged_by, occurred_at')
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
