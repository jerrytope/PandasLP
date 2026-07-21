const STORAGE_KEY = 'pandas_attribution'

interface Attribution {
  source: string | null
  sourceDetail: string | null
}

// Reads ?ref=/utm_* off the URL on first visit and persists to localStorage — the magic-link
// auth round trip (app/auth/callback) drops query params, so by the time a case is created
// post-signin the original URL is long gone. Safe to call on every page load: once captured,
// later calls are no-ops so a mid-session navigation never overwrites the original source.
export function captureAttribution(): void {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(STORAGE_KEY)) return

  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')
  const utmSource = params.get('utm_source')
  if (!ref && !utmSource) return

  const source = ref || utmSource
  const detailParts: string[] = []
  for (const [key, value] of params.entries()) {
    if (key === 'ref' || key.startsWith('utm_')) detailParts.push(`${key}=${value}`)
  }

  const attribution: Attribution = { source, sourceDetail: detailParts.join('&') || null }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution))
}

export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return { source: null, sourceDetail: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { source: null, sourceDetail: null }
    return JSON.parse(raw) as Attribution
  } catch {
    return { source: null, sourceDetail: null }
  }
}
