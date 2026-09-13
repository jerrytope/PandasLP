import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // www.pandaslp.com.ng and the apex were both serving identical content (a real
        // duplicate-content SEO issue) — this makes www a hard redirect to the canonical apex
        // domain instead. permanent: true emits a 308.
        source: '/:path*',
        has: [{ type: 'host', value: 'www.pandaslp.com.ng' }],
        destination: 'https://pandaslp.com.ng/:path*',
        permanent: true,
      },
    ]
  },
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
        // Site-wide hardening headers.
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Report-Only, not enforcing, on purpose. This site has real inline scripts (the
          // JSON-LD blocks in app/layout.jsx/blog/recover-debt are type="application/ld+json"
          // and are never executed as script, so they don't need script-src at all — but the
          // GA4 init snippet in app/layout.jsx IS real inline JS, and this codebase has no
          // nonce/hash plumbing for it, hence 'unsafe-inline' on script-src below rather than a
          // stricter nonce-based policy). The frame-src/script-src entries for Paystack are
          // built from their documented checkout domains but have never been exercised against
          // a live checkout in a real browser from this environment. Report-Only logs any
          // violation to each visitor's browser console without blocking anything, so this is
          // safe to ship as-is — but it means nothing is actually enforced yet. After deploy:
          // open the site, run through checkout (or a Paystack test transaction) and a page
          // with GA4, and check the browser console for "Content-Security-Policy" reports. Once
          // a real run turns up nothing, promote this to a real `Content-Security-Policy` header
          // by renaming the key below.
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://js.paystack.co",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://api.paystack.co",
              "frame-src https://checkout.paystack.com https://standard.paystack.co",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
