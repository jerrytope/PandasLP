// What staff can edit on the public website (Admin → Site content), its defaults, and the
// checks on what they type. Pure: no database, so it is unit-tested and safe in the browser.
// Stored one group per row in public.site_content (add-site-content.sql); lib/siteContent.ts
// loads and saves it.
//
// THE RULE FOR A LAW FIRM'S SITE: placeholder photos may show (they are designed panels, not
// fake people), but numbers, client quotes and the founder's note NEVER show until a member of
// staff has filled them in AND switched them on. Made-up figures or testimonials on a law
// firm's site would mislead clients and break the advertising rules.

export const PHOTO_SLOTS = ['hero', 'lawyerReview', 'team', 'founder', 'office'] as const
export type PhotoSlot = (typeof PHOTO_SLOTS)[number]

export const PHOTO_SLOT_LABELS: Record<PhotoSlot, { title: string; hint: string }> = {
  hero: { title: 'Mission band', hint: 'Wide photo (landscape, at least 2000px wide): the firm at work.' },
  lawyerReview: { title: 'Lawyer reviewing a draft', hint: 'A lawyer reading or marking up a document. Landscape.' },
  team: { title: 'Team', hint: 'The team together. Landscape.' },
  founder: { title: 'Founder portrait', hint: 'Head and shoulders. Portrait (taller than wide).' },
  office: { title: 'Office', hint: 'The office or meeting room. Landscape.' },
}

export interface Photo {
  url: string | null
  alt: string
}

export interface SiteContent {
  announcement: { enabled: boolean; label: string; text: string; href: string }
  photos: Record<PhotoSlot, Photo>
  stats: { enabled: boolean; asOf: string; items: { value: string; label: string; definition: string }[] }
  quotes: { enabled: boolean; items: { quote: string; name: string; role: string; metrics: { value: string; label: string }[] }[] }
  founder: { enabled: boolean; name: string; title: string; note: string }
}

export type SiteContentKey = keyof SiteContent
export const SITE_CONTENT_KEYS: SiteContentKey[] = ['announcement', 'photos', 'stats', 'quotes', 'founder']

export const LIMITS = { stats: 4, quotes: 3, metrics: 2, shortText: 120, longText: 600, noteText: 1500 } as const

export const DEFAULT_SITE_CONTENT: SiteContent = {
  announcement: { enabled: true, label: 'New', text: 'The Property Law Agent now covers 12 states', href: '/property-law' },
  photos: Object.fromEntries(PHOTO_SLOTS.map((s) => [s, { url: null, alt: '' }])) as Record<PhotoSlot, Photo>,
  stats: { enabled: false, asOf: '', items: [] },
  quotes: { enabled: false, items: [] },
  founder: { enabled: false, name: '', title: '', note: '' },
}

// ----- Reading (anything malformed falls back to its default, never throws) -----

function str(v: unknown, max: number, fallback = ''): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : fallback
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** A photo URL is only ever https (Supabase Storage) or a same-site path. */
export function safeImageUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null
  if (v.startsWith('/') && !v.startsWith('//')) return v
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) ? u.toString() : null
  } catch {
    return null
  }
}

/** A link in the announcement bar: a same-site path or an https URL. */
export function safeHref(v: unknown): string {
  if (typeof v !== 'string') return ''
  const t = v.trim()
  if (t.startsWith('/') && !t.startsWith('//')) return t.slice(0, 300)
  try {
    return new URL(t).protocol === 'https:' ? t.slice(0, 300) : ''
  } catch {
    return ''
  }
}

export function normaliseGroup<K extends SiteContentKey>(key: K, raw: unknown): SiteContent[K] {
  const v = obj(raw)
  const d = DEFAULT_SITE_CONTENT
  switch (key) {
    case 'announcement':
      return {
        enabled: bool(v.enabled, d.announcement.enabled),
        label: str(v.label, 24, d.announcement.label),
        text: str(v.text, LIMITS.shortText, d.announcement.text),
        href: v.href === undefined ? d.announcement.href : safeHref(v.href),
      } as SiteContent[K]
    case 'photos': {
      const photos = {} as Record<PhotoSlot, Photo>
      for (const slot of PHOTO_SLOTS) {
        const p = obj(v[slot])
        photos[slot] = { url: safeImageUrl(p.url), alt: str(p.alt, LIMITS.shortText) }
      }
      return photos as SiteContent[K]
    }
    case 'stats':
      return {
        enabled: bool(v.enabled, false),
        asOf: str(v.asOf, 40),
        items: arr(v.items).slice(0, LIMITS.stats).map((i) => {
          const o = obj(i)
          return { value: str(o.value, 24), label: str(o.label, 80), definition: str(o.definition, LIMITS.shortText * 2) }
        }),
      } as SiteContent[K]
    case 'quotes':
      return {
        enabled: bool(v.enabled, false),
        items: arr(v.items).slice(0, LIMITS.quotes).map((i) => {
          const o = obj(i)
          return {
            quote: str(o.quote, LIMITS.longText),
            name: str(o.name, 80),
            role: str(o.role, 120),
            metrics: arr(o.metrics).slice(0, LIMITS.metrics).map((m) => ({ value: str(obj(m).value, 24), label: str(obj(m).label, 80) })),
          }
        }),
      } as SiteContent[K]
    case 'founder':
      return {
        enabled: bool(v.enabled, false),
        name: str(v.name, 80),
        title: str(v.title, 120),
        note: str(v.note, LIMITS.noteText),
      } as SiteContent[K]
  }
  throw new RangeError(`Unknown site content group: ${String(key)}`)
}

/** Every group, from the stored rows (missing or malformed ones take their defaults). */
export function normaliseSiteContent(rows: Partial<Record<string, unknown>>): SiteContent {
  return {
    announcement: rows.announcement === undefined ? DEFAULT_SITE_CONTENT.announcement : normaliseGroup('announcement', rows.announcement),
    photos: normaliseGroup('photos', rows.photos),
    stats: normaliseGroup('stats', rows.stats),
    quotes: normaliseGroup('quotes', rows.quotes),
    founder: normaliseGroup('founder', rows.founder),
  }
}

// ----- What the public site may show -----

/** Numbers show only when switched on, dated, and every shown item is complete. */
export function publishableStats(c: SiteContent): SiteContent['stats']['items'] {
  if (!c.stats.enabled || !c.stats.asOf) return []
  return c.stats.items.filter((i) => i.value && i.label && i.definition)
}

/** Quotes show only when switched on and each has the words and who said them. */
export function publishableQuotes(c: SiteContent): SiteContent['quotes']['items'] {
  if (!c.quotes.enabled) return []
  return c.quotes.items.filter((q) => q.quote && q.name).map((q) => ({ ...q, metrics: q.metrics.filter((m) => m.value && m.label) }))
}

export function publishableFounder(c: SiteContent): SiteContent['founder'] | null {
  return c.founder.enabled && c.founder.name && c.founder.note ? c.founder : null
}

export function publishableAnnouncement(c: SiteContent): SiteContent['announcement'] | null {
  return c.announcement.enabled && c.announcement.text ? c.announcement : null
}

/** Everything the public site may use, and nothing it may not (no switched-off groups). */
export interface PublicSiteContent {
  announcement: SiteContent['announcement'] | null
  photos: SiteContent['photos']
  stats: { asOf: string; items: SiteContent['stats']['items'] }
  quotes: SiteContent['quotes']['items']
  founder: SiteContent['founder'] | null
}

export function publicSiteContent(c: SiteContent): PublicSiteContent {
  return {
    announcement: publishableAnnouncement(c),
    photos: c.photos,
    stats: { asOf: c.stats.asOf, items: publishableStats(c) },
    quotes: publishableQuotes(c),
    founder: publishableFounder(c),
  }
}

/** Problems that stop a group being switched on, in plain English. Empty = fine. */
export function publishProblems<K extends SiteContentKey>(key: K, value: SiteContent[K]): string[] {
  const problems: string[] = []
  if (key === 'stats') {
    const v = value as SiteContent['stats']
    if (v.enabled) {
      if (!v.asOf) problems.push('Add the "as of" date the numbers are true for.')
      if (v.items.length === 0) problems.push('Add at least one number.')
      v.items.forEach((i, n) => {
        if (!i.value || !i.label || !i.definition) problems.push(`Number ${n + 1}: fill in the figure, its label and exactly what it counts.`)
      })
    }
  }
  if (key === 'quotes') {
    const v = value as SiteContent['quotes']
    if (v.enabled) {
      if (v.items.length === 0) problems.push('Add at least one quote.')
      v.items.forEach((q, n) => {
        if (!q.quote || !q.name) problems.push(`Quote ${n + 1}: fill in the words and who said them.`)
      })
    }
  }
  if (key === 'founder') {
    const v = value as SiteContent['founder']
    if (v.enabled && (!v.name || !v.note)) problems.push('Fill in the name and the note before switching it on.')
  }
  if (key === 'announcement') {
    const v = value as SiteContent['announcement']
    if (v.enabled && !v.text) problems.push('Write the announcement, or switch it off.')
  }
  return problems
}

/** What an uploaded photo really is, from its first bytes (never the browser's say-so). */
export function sniffImage(bytes: Uint8Array): { ext: 'jpg' | 'png' | 'webp'; contentType: string } | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length > 8 && png.every((b, i) => bytes[i] === b)) return { ext: 'png', contentType: 'image/png' }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', contentType: 'image/webp' }
  return null
}

export const PHOTO_MAX_BYTES = 3 * 1024 * 1024
