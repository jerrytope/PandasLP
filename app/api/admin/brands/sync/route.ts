export const runtime = 'nodejs'
// Same time budget as the scheduled sync (app/api/cron/brand-sheets/route.ts).
export const maxDuration = 300

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { runBrandSync } from '@/lib/brandSync'

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 5 * 60 * 1000

/** The sync schedule shown on Admin → Brands. */
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const { data } = await supabaseAdmin
    .from('firm_settings')
    .select('brand_sync_interval_minutes, brand_sync_last_run_at, brand_sync_lease_until')
    .eq('id', 1)
    .single()
  return Response.json({
    intervalMinutes: data?.brand_sync_interval_minutes ?? 60,
    lastRunAt: data?.brand_sync_last_run_at ?? null,
    running: Boolean(data?.brand_sync_lease_until && new Date(data.brand_sync_lease_until) > new Date()),
  })
}

/** "Sync now" — runs straight away (ignoring the interval), for every brand or just one. */
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-brand-sync:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const body = (await req.json().catch(() => ({}))) as { brandId?: string }
  try {
    const result = await runBrandSync({ force: true, brandId: body.brandId })
    if (!result.ran) return Response.json({ error: result.reason }, { status: 409 })
    return Response.json({ ok: true, reports: result.reports })
  } catch (err) {
    console.error('Sync now failed:', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Sync failed.' }, { status: 500 })
  }
}

/** Change how often the scheduled sync runs (15 minutes to 24 hours). */
export async function PATCH(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  const body = (await req.json().catch(() => ({}))) as { intervalMinutes?: number }
  const minutes = Number(body.intervalMinutes)
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 1440) {
    return Response.json({ error: 'Choose an interval between 15 minutes and 24 hours.' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('firm_settings').update({ brand_sync_interval_minutes: minutes }).eq('id', 1)
  if (error) return Response.json({ error: 'Could not save the interval.' }, { status: 500 })
  return Response.json({ ok: true, intervalMinutes: minutes })
}
