import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SITE_CONTENT,
  normaliseGroup,
  normaliseSiteContent,
  publishableAnnouncement,
  publishableFounder,
  publishableQuotes,
  publishableStats,
  publishProblems,
  safeHref,
  safeImageUrl,
  sniffImage,
  PHOTO_SLOTS,
} from '../siteContentSchema'

describe('site content: reading what is stored', () => {
  it('falls back to the defaults for missing or malformed groups', () => {
    const c = normaliseSiteContent({})
    expect(c.stats).toEqual({ enabled: false, asOf: '', items: [] })
    expect(c.quotes.enabled).toBe(false)
    expect(c.announcement).toEqual(DEFAULT_SITE_CONTENT.announcement)
    for (const slot of PHOTO_SLOTS) expect(c.photos[slot]).toEqual({ url: null, alt: '' })
    expect(normaliseSiteContent({ stats: 'nonsense', photos: [1, 2] }).stats.items).toEqual([])
  })

  it('caps lists and text lengths', () => {
    const stats = normaliseGroup('stats', { enabled: true, asOf: 'Oct 2026', items: Array.from({ length: 9 }, () => ({ value: 'x'.repeat(100), label: 'l', definition: 'd' })) })
    expect(stats.items).toHaveLength(4)
    expect(stats.items[0].value).toHaveLength(24)
  })

  it('only keeps https (or local) image URLs and same-site or https links', () => {
    expect(safeImageUrl('https://x.supabase.co/storage/v1/object/public/site-media/a.jpg')).toMatch(/^https:/)
    expect(safeImageUrl('http://127.0.0.1:54321/storage/a.jpg')).toMatch(/^http:/)
    expect(safeImageUrl('http://evil.example/a.jpg')).toBeNull()
    expect(safeImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeImageUrl('//evil.example/a.jpg')).toBeNull()
    expect(safeHref('/property-law')).toBe('/property-law')
    expect(safeHref('https://example.com/x')).toBe('https://example.com/x')
    expect(safeHref('javascript:alert(1)')).toBe('')
    expect(safeHref('//evil.example')).toBe('')
  })
})

describe('site content: what the public site may show', () => {
  const filled = normaliseSiteContent({
    stats: { enabled: true, asOf: 'October 2026', items: [{ value: '140', label: 'Letters served', definition: 'Marked served since launch' }, { value: '9', label: '', definition: '' }] },
    quotes: { enabled: true, items: [{ quote: 'They paid.', name: 'Ada', role: 'Director', metrics: [{ value: '₦2m', label: 'recovered' }, { value: '', label: '' }] }, { quote: '', name: 'No words' }] },
    founder: { enabled: true, name: 'Temitope', title: 'Founder', note: 'Why we built this.' },
  })

  it('shows numbers only when switched on, dated, and complete', () => {
    expect(publishableStats(filled)).toEqual([{ value: '140', label: 'Letters served', definition: 'Marked served since launch' }])
    expect(publishableStats({ ...filled, stats: { ...filled.stats, enabled: false } })).toEqual([])
    expect(publishableStats({ ...filled, stats: { ...filled.stats, asOf: '' } })).toEqual([])
  })

  it('shows quotes only when switched on and attributed, without empty results', () => {
    const q = publishableQuotes(filled)
    expect(q).toHaveLength(1)
    expect(q[0].metrics).toEqual([{ value: '₦2m', label: 'recovered' }])
    expect(publishableQuotes({ ...filled, quotes: { ...filled.quotes, enabled: false } })).toEqual([])
  })

  it('never shows anything by default except the placeholder photos and the announcement', () => {
    const c = normaliseSiteContent({})
    expect(publishableStats(c)).toEqual([])
    expect(publishableQuotes(c)).toEqual([])
    expect(publishableFounder(c)).toBeNull()
    expect(publishableAnnouncement(c)?.text).toBeTruthy()
    expect(publishableFounder(filled)?.name).toBe('Temitope')
  })

  it('refuses to switch on an unfinished group, in plain English', () => {
    expect(publishProblems('stats', normaliseGroup('stats', { enabled: true, items: [{ value: '1' }] })).join(' ')).toMatch(/as of.*Number 1/s)
    expect(publishProblems('quotes', normaliseGroup('quotes', { enabled: true, items: [] }))).toEqual(['Add at least one quote.'])
    expect(publishProblems('founder', normaliseGroup('founder', { enabled: true, name: 'A' }))).toHaveLength(1)
    expect(publishProblems('stats', normaliseGroup('stats', { enabled: false, items: [{ value: '1' }] }))).toEqual([])
  })
})

describe('uploaded photos', () => {
  it('are recognised by their bytes, not their name', () => {
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.ext).toBe('jpg')
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext).toBe('png')
    expect(sniffImage(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))?.ext).toBe('webp')
    expect(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull()
    expect(sniffImage(new TextEncoder().encode('%PDF-1.7'))).toBeNull()
  })
})
