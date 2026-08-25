import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/agent/', '/auth/', '/api/', '/property-law'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
