export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-custom-claims:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const { data, error } = await supabaseAdmin
    .from('custom_claims')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: 'Failed to load custom claims.' }, { status: 500 })
  }

  return Response.json({ claims: data ?? [] })
}
