import type { MetadataRoute } from 'next'

// Next's App Router file convention — this auto-serves at /manifest.webmanifest and gets
// auto-linked in <head>, no manual <link rel="manifest"> needed in app/layout.jsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pandas LP',
    short_name: 'Pandas LP',
    description: "A licensed Lagos law firm that recovers what you're owed: demand letter today, court in 14 days if it's ignored.",
    start_url: '/',
    display: 'standalone',
    background_color: '#182A3A',
    theme_color: '#182A3A',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
