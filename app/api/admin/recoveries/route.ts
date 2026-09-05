import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 5 * 60 * 1000
const MAX_FILE_BYTES = 10 * 1024 * 1024

const BUCKET = 'case-documents'

// Same bucket as the reviewed-document upload, different prefix. Keyed by the recovery row's
// own id rather than the case id, because one case can have several recoveries (a debtor
// paying in instalments) and each needs its own evidence.
const EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

// Confirm money actually recovered for a client. This is the only writer of public.recoveries,
// and public.recoveries is the only source of the figure published on the homepage, so the
// validation here is deliberately unforgiving: a number nobody can evidence should never reach
// the public total.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-recoveries:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const adminEmail = authResult.user.email || 'unknown'

  let body: {
    caseId?: string
    amountRecovered?: number | string
    isFull?: boolean
    shortfallReason?: string
    proofNote?: string
    proofBase64?: string
    proofType?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { caseId, isFull, proofBase64, proofType } = body
  const shortfallReason = (body.shortfallReason || '').trim()
  const proofNote = (body.proofNote || '').trim()

  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }
  if (typeof isFull !== 'boolean') {
    return Response.json({ error: 'Say whether this is the full amount or only part of it.' }, { status: 400 })
  }

  // Naira, whole units — matches cases.amount_paid and cases.expected_amount.
  const amountRecovered = Number(body.amountRecovered)
  if (!Number.isFinite(amountRecovered) || !Number.isInteger(amountRecovered) || amountRecovered <= 0) {
    return Response.json({ error: 'Amount recovered must be a whole number of naira above zero.' }, { status: 400 })
  }

  if (!proofNote) {
    return Response.json({ error: 'Proof of recovery is required. Give the transfer reference, bank narration or receipt number.' }, { status: 400 })
  }

  // The rule the user asked for: a partial recovery has to say why the rest was not recovered.
  // Mirrored by a CHECK constraint on the table, so this cannot be bypassed by another writer.
  if (!isFull && !shortfallReason) {
    return Response.json({ error: 'This is a partial recovery, so a reason why the full amount was not recovered is required.' }, { status: 400 })
  }

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('id, case_number, expected_amount')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('recoveries')
    .insert({
      case_id: caseId,
      amount_recovered: amountRecovered,
      claim_amount: caseData.expected_amount ?? null,
      is_full: isFull,
      shortfall_reason: isFull ? null : shortfallReason,
      proof_note: proofNote,
      confirmed_by: adminEmail,
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('Failed to record recovery:', insertErr)
    return Response.json({ error: 'Could not record the recovery.' }, { status: 500 })
  }

  // Optional supporting file. Deliberately after the insert and non-fatal: a recorded recovery
  // with a proof note but no attachment is still a valid record, and losing the whole
  // confirmation because a screenshot failed to upload would be worse than the missing file.
  let proofPath: string | null = null
  let proofWarning: string | null = null

  if (proofBase64) {
    const ext = EXT[proofType || '']
    if (!ext) {
      proofWarning = 'The recovery was recorded, but the proof file was not attached: only PDF, PNG and JPEG are accepted.'
    } else if (Math.ceil((proofBase64.length * 3) / 4) > MAX_FILE_BYTES) {
      proofWarning = 'The recovery was recorded, but the proof file was not attached: maximum size is 10 MB.'
    } else {
      const path = `recovery-proof/${inserted.id}.${ext}`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, Buffer.from(proofBase64, 'base64'), { contentType: proofType, upsert: true })

      if (uploadErr) {
        console.error('Failed to upload recovery proof:', uploadErr)
        proofWarning = 'The recovery was recorded, but the proof file could not be uploaded.'
      } else {
        proofPath = path
        await supabaseAdmin.from('recoveries').update({ proof_path: path }).eq('id', inserted.id)
      }
    }
  }

  return Response.json({ ok: true, id: inserted.id, proofPath, warning: proofWarning })
}

// Everything recorded against one case, newest first, for the admin case view.
export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-recoveries-get:${getClientIp(req)}`, 60, RATE_WINDOW_MS)
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
    .from('recoveries')
    .select('id, amount_recovered, claim_amount, is_full, shortfall_reason, proof_note, proof_path, confirmed_by, confirmed_at')
    .eq('case_id', caseId)
    .order('confirmed_at', { ascending: false })

  if (error) {
    console.error('Failed to load recoveries:', error)
    return Response.json({ error: 'Could not load recoveries.' }, { status: 500 })
  }

  // Short-lived signed URLs so proof is viewable in the admin UI without making the bucket public.
  const recoveries = await Promise.all(
    (data || []).map(async (r) => {
      if (!r.proof_path) return { ...r, proofUrl: null }
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(r.proof_path, 60 * 10)
      return { ...r, proofUrl: signed?.signedUrl ?? null }
    }),
  )

  return Response.json({ recoveries })
}
