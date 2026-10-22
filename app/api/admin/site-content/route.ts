export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { getSiteContent, saveSiteContentGroup, siteContentChanges, clearSiteContentCache, uploadSitePhoto } from '@/lib/siteContent'
import { normaliseGroup, PHOTO_SLOTS, publishProblems, SITE_CONTENT_KEYS, type PhotoSlot, type SiteContentKey } from '@/lib/siteContentSchema'

// Admin → Site content. GET: everything (including what is switched off) and who changed it.
// POST { key, value }: saves one group. POST { action: 'photo', slot, fileBase64 }: uploads a
// photo to the public site-media bucket and sets it on that slot (alt text is kept).

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

function limited(req: Request): Response | null {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-site-content:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  return allowed ? null : Response.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
}

export async function GET(req: Request) {
  const tooMany = limited(req)
  if (tooMany) return tooMany
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  clearSiteContentCache()
  try {
    const [content, changes] = await Promise.all([getSiteContent(), siteContentChanges()])
    return Response.json({ content, changes })
  } catch (err) {
    console.error('site content GET failed:', err)
    return Response.json({ error: 'Could not load the site content.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const tooMany = limited(req)
  if (tooMany) return tooMany
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const by = auth.user.email ?? auth.user.id

  let body: { action?: string; key?: string; value?: unknown; slot?: string; fileBase64?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  try {
    if (body.action === 'photo') {
      if (!(PHOTO_SLOTS as readonly string[]).includes(body.slot ?? '')) return Response.json({ error: 'Unknown photo slot.' }, { status: 400 })
      if (typeof body.fileBase64 !== 'string') return Response.json({ error: 'Missing the photo.' }, { status: 400 })
      const uploaded = await uploadSitePhoto(body.slot as PhotoSlot, Buffer.from(body.fileBase64, 'base64'))
      if (uploaded.ok === false) return Response.json({ error: uploaded.error }, { status: uploaded.status })
      const current = (await getSiteContent()).photos
      const photos = { ...current, [body.slot as PhotoSlot]: { ...current[body.slot as PhotoSlot], url: uploaded.url } }
      const saved = await saveSiteContentGroup('photos', photos, by)
      return Response.json({ ok: true, value: saved })
    }

    if (!(SITE_CONTENT_KEYS as string[]).includes(body.key ?? '')) return Response.json({ error: 'Unknown section.' }, { status: 400 })
    const key = body.key as SiteContentKey
    const problems = publishProblems(key, normaliseGroup(key, body.value))
    if (problems.length) return Response.json({ error: problems.join(' ') }, { status: 422 })
    const saved = await saveSiteContentGroup(key, body.value, by)
    return Response.json({ ok: true, value: saved })
  } catch (err) {
    console.error('site content POST failed:', err)
    return Response.json({ error: 'Something went wrong. Nothing was changed.' }, { status: 500 })
  }
}
