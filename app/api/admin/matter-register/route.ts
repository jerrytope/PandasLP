export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/adminAuth'
import { syncPaidCaseToRegister, syncRecoveryIdToRegister } from '@/lib/matterRegisterSync'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`matter-register:${getClientIp(req)}`, 20, 5 * 60 * 1000)
  if (!allowed) {
    return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  }

  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth

  let body: { caseId?: string; recoveryId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (Boolean(body.caseId) === Boolean(body.recoveryId)) {
    return Response.json({ error: 'Provide exactly one caseId or recoveryId.' }, { status: 400 })
  }

  const result = body.caseId
    ? await syncPaidCaseToRegister(body.caseId)
    : await syncRecoveryIdToRegister(body.recoveryId!)
  if (!result.ok) {
    return Response.json({ error: `The register did not accept the case (${result.error}).` }, { status: 502 })
  }
  return Response.json({ ok: true })
}

export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`matter-register-status:${getClientIp(req)}`, 60, 5 * 60 * 1000)
  if (!allowed) {
    return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  }
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth

  const url = new URL(req.url)
  const caseId = url.searchParams.get('caseId')
  const recoveryId = url.searchParams.get('recoveryId')
  if (Boolean(caseId) === Boolean(recoveryId)) {
    return Response.json({ error: 'Provide exactly one caseId or recoveryId.' }, { status: 400 })
  }

  const recordType = caseId ? 'case' : 'recovery'
  const recordId = caseId ?? recoveryId!
  const { data, error } = await supabaseAdmin
    .from('matter_register_syncs')
    .select('status, error, last_attempt_at')
    .eq('record_type', recordType)
    .eq('record_id', recordId)
    .maybeSingle()
  if (error) {
    console.error('Could not load matter register sync status:', error)
    return Response.json({ error: 'Could not load register status. Apply add-matter-register-sync.sql, then retry.' }, { status: 500 })
  }
  return Response.json({ sync: data })
}
