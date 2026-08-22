// Deliberately minimal. This app is dynamic and auth-gated (live case status, payment flow,
// dashboard data) — a service worker that aggressively caches pages or API responses would
// risk showing a client a stale case status, a stale "paid" state, or interfering with the
// Paystack checkout flow. That's not an acceptable tradeoff for "works offline."
//
// This service worker exists ONLY to satisfy installability (Chrome requires a registered
// fetch handler before it will offer the "Install app" prompt) — it caches a small, fixed
// list of pure-static brand assets and nothing else. Every other request goes straight to
// the network; the cache is only ever consulted as a fallback if the network request itself
// fails (e.g. genuinely offline), never as a first choice.
const CACHE_NAME = 'pandas-lp-static-v1'
const STATIC_ASSETS = ['/favicon.png', '/logo-mark.png', '/logo-mark-light.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Never intercept anything but a plain GET — POST (payment verification, case updates,
  // chat turns, etc.) must always hit the network directly, never be cache-adjacent.
  if (event.request.method !== 'GET') return
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
})
