// Loads and saves the editable parts of the public website (public.site_content,
// add-site-content.sql). Server-only: uses the service-role client. The shape, defaults and
// the "what may be shown" rules are in lib/siteContentSchema.ts.
//
// The public site must never break because of this: if the table can't be read, every group
// takes its default (placeholder photos, no numbers, no quotes).

import { supabaseAdmin } from './supabaseAdmin'
import {
  normaliseGroup,
  normaliseSiteContent,
  sniffImage,
  PHOTO_MAX_BYTES,
  type PhotoSlot,
  type SiteContent,
  type SiteContentKey,
} from './siteContentSchema'

const BUCKET = 'site-media'
const CACHE_MS = 30_000
let cache: { at: number; content: SiteContent } | null = null

export function clearSiteContentCache(): void {
  cache = null
}

export async function getSiteContent(): Promise<SiteContent> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.content
  try {
    const { data, error } = await supabaseAdmin.from('site_content').select('key, value')
    if (error) throw new Error(error.message)
    const rows = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as unknown]))
    const content = normaliseSiteContent(rows)
    cache = { at: Date.now(), content }
    return content
  } catch (err) {
    console.error('Could not load the site content; using the defaults:', err)
    return normaliseSiteContent({})
  }
}

/** Saves one group (already checked by the caller) and returns it as stored. */
export async function saveSiteContentGroup<K extends SiteContentKey>(key: K, raw: unknown, by: string): Promise<SiteContent[K]> {
  const value = normaliseGroup(key, raw)
  const { error } = await supabaseAdmin
    .from('site_content')
    .upsert({ key, value, updated_by: by, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`Could not save the ${key}: ${error.message}`)
  clearSiteContentCache()
  return value
}

/** When each group was last changed, and by whom (for the admin). */
export async function siteContentChanges(): Promise<Record<string, { by: string | null; at: string }>> {
  const { data, error } = await supabaseAdmin.from('site_content').select('key, updated_by, updated_at')
  if (error) throw new Error(error.message)
  return Object.fromEntries((data ?? []).map((r) => [r.key, { by: r.updated_by, at: r.updated_at }]))
}

export type UploadResult = { ok: true; url: string } | { ok: false; status: number; error: string }

/**
 * Stores an uploaded photo in the public site-media bucket under a new name (so a browser
 * never keeps showing an old photo from its cache) and returns its public URL. The caller then
 * saves that URL into the photos group.
 */
export async function uploadSitePhoto(slot: PhotoSlot, file: Buffer): Promise<UploadResult> {
  if (file.length === 0) return { ok: false, status: 400, error: 'The file is empty.' }
  if (file.length > PHOTO_MAX_BYTES) return { ok: false, status: 413, error: 'The photo is too large. Maximum 3 MB: export it as a JPG at about 2000px wide.' }
  const kind = sniffImage(file)
  if (!kind) return { ok: false, status: 400, error: 'Upload a JPG, PNG or WebP photo.' }
  const path = `photos/${slot}-${Date.now()}.${kind.ext}`
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, file, { contentType: kind.contentType, upsert: false, cacheControl: '31536000' })
  if (error) return { ok: false, status: 500, error: `Could not store the photo: ${error.message}` }
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}
