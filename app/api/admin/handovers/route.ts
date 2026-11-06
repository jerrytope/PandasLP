export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-handovers:${getClientIp(req)}`, 60, 5 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const { data, error } = await supabaseAdmin.from('lawyer_handovers').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(100)
  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205'
    return Response.json({ error: missing ? 'Run add-lawyer-handovers.sql in Supabase first.' : 'Could not load lawyer handovers.', setupNeeded: missing }, { status: missing ? 503 : 500 })
  }
  return Response.json({ items: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  let body: { id?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (typeof body.id !== 'string' || !body.id) return Response.json({ error: 'Missing handover id.' }, { status: 400 })
  const { data, error } = await supabaseAdmin
    .from('lawyer_handovers')
    .update({ status: 'done', handled_at: new Date().toISOString(), handled_by: auth.user.email ?? 'staff' })
    .eq('id', body.id)
    .eq('status', 'open')
    .select('id')
  if (error) return Response.json({ error: 'Could not mark handover complete.' }, { status: 500 })
  if (!data?.length) return Response.json({ error: 'Handover not found or already completed.' }, { status: 404 })
  return Response.json({ ok: true })
}
