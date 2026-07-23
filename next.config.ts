import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Logo, favicon, and icon assets served from /public. Not using
        // `immutable` + a long max-age here on purpose: these files get
        // replaced in place under the same filename when branding changes
        // (this project has already done that more than once), and
        // `immutable` would leave returning visitors on a stale logo for
        // up to a year. This still gives fast repeat loads while checking
        // for updates in the background.
        source: '/:path*.(png|svg|jpg|jpeg|webp|ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
        ],
      },
      {
        // Site-wide hardening headers. Deliberately NOT including a Content-Security-Policy
        // here — this app has inline <script> tags (JSON-LD in app/layout.jsx and the blog/
        // recover-debt pages, the GA4 snippet) plus the Paystack inline checkout script, and a
        // CSP needs to be built and tested against every one of those individually or it'll
        // silently break them. These four are safe on their own with no such risk.
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

export default nextConfig
