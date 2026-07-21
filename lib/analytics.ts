declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

// No-ops until NEXT_PUBLIC_GA_MEASUREMENT_ID is set and app/layout.jsx renders the GA4 script
// tags — call sites don't need to know whether analytics is configured.
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', name, params)
}
