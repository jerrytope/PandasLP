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
    ]
  },
}

export default nextConfig
