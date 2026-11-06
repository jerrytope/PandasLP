import { supabaseAdmin } from './supabaseAdmin'
import { lagosToday } from './negotiationStatus'
import { buildRegisterRow } from './matterRegisterRow'

const TIMEOUT_MS = 8000

export function isRegisterSyncConfigured(): boolean {
  return Boolean(process.env.MATTER_REGISTER_WEBHOOK_URL && process.env.MATTER_REGISTER_SECRET)
}

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.MATTER_REGISTER_WEBHOOK_URL
  const secret = process.env.MATTER_REGISTER_SECRET
  if (!url || !secret) return { ok: false, error: 'not configured' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret, ...body }),
      signal: controller.signal,
      redirect: 'follow',
    })
    const text = await response.text()
    let result: { ok?: boolean; error?: string } = {}
    try {
      result = JSON.parse(text)
    } catch {
      // The endpoint may return an HTML error page instead of JSON.
    }
    if (!response.ok || !result.ok) return { ok: false, error: result.error || `HTTP ${response.status}` }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'request failed' }
  } finally {
    clearTimeout(timer)
  }
}

async function recordSyncStatus(
  recordType: 'case' | 'recovery',
  recordId: string,
  result: { ok: boolean; error?: string },
) {
  const { error } = await supabaseAdmin.from('matter_register_syncs').upsert({
    record_type: recordType,
    record_id: recordId,
    status: result.ok ? 'synced' : 'failed',
    error: result.ok ? null : result.error ?? 'Register rejected the request.',
    last_attempt_at: new Date().toISOString(),
  }, { onConflict: 'record_type,record_id' })
  if (error) console.error(`Matter register: could not record ${recordType} sync status for ${recordId}:`, error)
}

export async function syncPaidCaseToRegister(caseId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: c, error } = await supabaseAdmin.from('cases').select('*').eq('id', caseId).maybeSingle()
  if (error || !c) {
    console.error(`Matter register: could not load case ${caseId}:`, error)
    const result = { ok: false, error: 'case not found' }
    await recordSyncStatus('case', caseId, result)
    return result
  }
  if (c.is_test || !['small-claims', 'judgment-enforcement'].includes(c.agent_id)) return { ok: true }
  if (!['paid', 'letter_served', 'filed', 'judgment_obtained', 'closed'].includes(c.status) || !(c.amount_paid > 0)) {
    const result = { ok: false, error: 'case is not paid' }
    await recordSyncStatus('case', caseId, result)
    return result
  }
  if (!isRegisterSyncConfigured()) {
    const result = { ok: false, error: 'not configured' }
    await recordSyncStatus('case', caseId, result)
    return result
  }

  let userEmail: string | null = c.client_email ?? null
  if (!userEmail && c.user_id) {
    const { data, error: userError } = await supabaseAdmin.auth.admin.getUserById(c.user_id)
    if (userError) console.error(`Matter register: could not load client email for case ${caseId}:`, userError)
    userEmail = data?.user?.email ?? null
  }
  const result = await post({ type: 'matter', row: buildRegisterRow({ ...c, userEmail }) })
  if (!result.ok && result.error !== 'not configured') {
    console.error(`Matter register: could not add case ${caseId}:`, result.error)
  }
  await recordSyncStatus('case', caseId, result)
  return result
}

export async function syncRecoveryToRegister(input: {
  recoveryId: string
  caseId: string
  amount: number
  note: string | null
  isFull: boolean
}): Promise<{ ok: boolean; error?: string }> {
  if (!isRegisterSyncConfigured()) {
    const result = { ok: false, error: 'not configured' }
    await recordSyncStatus('recovery', input.recoveryId, result)
    return result
  }
  const caseSync = await syncPaidCaseToRegister(input.caseId)
  if (!caseSync.ok) {
    await recordSyncStatus('recovery', input.recoveryId, caseSync)
    return caseSync
  }
  const result = await post({
    type: 'payment',
    payment: {
      recoveryId: input.recoveryId,
      caseId: input.caseId,
      date: lagosToday(),
      amount: input.amount,
      note: [input.isFull ? 'Full recovery' : 'Part recovery', input.note].filter(Boolean).join(': '),
      cleared: input.isFull,
    },
  })
  if (!result.ok && result.error !== 'not configured') {
    console.error(`Matter register: could not add recovery ${input.recoveryId}:`, result.error)
  }
  await recordSyncStatus('recovery', input.recoveryId, result)
  return result
}

export async function syncRecoveryIdToRegister(recoveryId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: recovery, error } = await supabaseAdmin
    .from('recoveries')
    .select('id, case_id, amount_recovered, is_full, proof_note')
    .eq('id', recoveryId)
    .maybeSingle()
  if (error || !recovery) {
    console.error(`Matter register: could not load recovery ${recoveryId}:`, error)
    const result = { ok: false, error: 'recovery not found' }
    await recordSyncStatus('recovery', recoveryId, result)
    return result
  }
  return syncRecoveryToRegister({
    recoveryId: recovery.id,
    caseId: recovery.case_id,
    amount: recovery.amount_recovered,
    note: recovery.proof_note,
    isFull: recovery.is_full,
  })
}
