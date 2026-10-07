export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { deleteBrand, parseBrandInput, parseBrandUpdate, runBrandSetup, updateBrand } from '@/lib/brands'
import { getGoogleConnectionStatus, googleConfigStatus } from '@/lib/google/oauth'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

function rateLimited(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-brands:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (allowed) return null
  return Response.json(
    { error: 'Too many requests — please wait a moment before trying again.' },
    { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
  )
}

// The Brands admin screen: every brand, with case counts by status and open flags, plus the
// state of the Google Drive connection.
export async function GET(req: Request) {
  const limited = rateLimited(req)
  if (limited) return limited
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const [{ data: brands, error }, { data: caseRows }, { data: flagRows }, google] = await Promise.all([
    supabaseAdmin.from('brands').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('brand_cases').select('brand_id, status'),
    supabaseAdmin.from('brand_change_flags').select('brand_id').is('resolved_at', null),
    getGoogleConnectionStatus(),
  ])
  if (error) return Response.json({ error: 'Failed to load brands.' }, { status: 500 })

  const counts: Record<string, Record<string, number>> = {}
  for (const c of caseRows ?? []) {
    counts[c.brand_id] ??= {}
    counts[c.brand_id][c.status] = (counts[c.brand_id][c.status] ?? 0) + 1
  }
  const openFlags: Record<string, number> = {}
  for (const f of flagRows ?? []) openFlags[f.brand_id] = (openFlags[f.brand_id] ?? 0) + 1

  const fake = process.env.GOOGLE_FAKE_WORKSPACE === 'true' && process.env.VERCEL_ENV !== 'production'
  return Response.json({
    brands: (brands ?? []).map((b) => ({ ...b, case_counts: counts[b.id] ?? {}, open_flags: openFlags[b.id] ?? 0 })),
    google: { ...google, ...googleConfigStatus(), fake },
  })
}

// "New brand": save it, then build its folder + sheet in the connected Drive. If Google fails
// the brand is still saved (with the error) and "Retry setup" finishes the job later.
export async function POST(req: Request) {
  const limited = rateLimited(req)
  if (limited) return limited
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const parsed = parseBrandInput(await req.json().catch(() => null))
  if (parsed.ok === false) return Response.json({ error: parsed.error }, { status: 400 })
  const input = parsed.value

  const { data: brand, error } = await supabaseAdmin
    .from('brands')
    .insert({
      name: input.name,
      code: input.code,
      address: input.address,
      contact_emails: input.contactEmails,
      per_letter_fee_kobo: input.perLetterFeeKobo,
      created_by: authResult.user.email ?? 'unknown',
      // Brand matters (cases rows) are owned by this staff account; see add-brand-sync.sql.
      owner_user_id: authResult.user.id,
    })
    .select('id')
    .single()
  if (error || !brand) {
    if (error?.code === '23505') return Response.json({ error: `Brand code ${input.code} is already used.` }, { status: 409 })
    console.error('Failed to create brand:', error)
    return Response.json({ error: 'Could not save the brand.' }, { status: 500 })
  }

  const setup = await runBrandSetup(brand.id)
  return Response.json({ ok: true, id: brand.id, setup }, { status: 201 })
}

// Brand actions:
//   "update"     — save an edit (name, contacts, fee, active) and update Drive sharing/names to match
//   "retrySetup" — resume a Google setup that failed part-way
export async function PATCH(req: Request) {
  const limited = rateLimited(req)
  if (limited) return limited
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const body = (await req.json().catch(() => null)) as ({ brandId?: string; action?: string } & Record<string, unknown>) | null
  if (!body?.brandId) return Response.json({ error: 'Missing brandId.' }, { status: 400 })

  if (body.action === 'retrySetup') {
    const setup = await runBrandSetup(body.brandId)
    if (setup.ok === false) return Response.json({ error: setup.error }, { status: 502 })
    return Response.json({ ok: true })
  }

  if (body.action === 'update') {
    const parsed = parseBrandUpdate(body)
    if (parsed.ok === false) return Response.json({ error: parsed.error }, { status: 400 })
    const result = await updateBrand(body.brandId, parsed.value)
    if (result.ok === false) return Response.json({ error: result.error }, { status: result.status })
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 })
}

// Delete a brand that has never had borrowers (its Drive folder goes to the bin). A brand with
// borrowers is refused with 409 — deactivate it instead, so its legal records stay.
export async function DELETE(req: Request) {
  const limited = rateLimited(req)
  if (limited) return limited
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const brandId = new URL(req.url).searchParams.get('brandId')
  if (!brandId) return Response.json({ error: 'Missing brandId.' }, { status: 400 })
  const result = await deleteBrand(brandId)
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ ok: true })
}
