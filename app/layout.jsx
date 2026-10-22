import Script from 'next/script'
import { Manrope, Inter, JetBrains_Mono } from 'next/font/google'
import { MotionConfig } from 'framer-motion'
import { safeJsonLd } from '@/lib/jsonLd'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { THEME_COLOR, THEME_INIT_SCRIPT } from '@/lib/theme'
import './globals.css'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

// "Ink & Brass" (docs/frontend-revamp-plan.md): Manrope for headings, Inter for reading,
// JetBrains Mono for the small labels, matter IDs, run-logs, prices and dates.
const display = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
})

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'
// Both practice areas, in the order they matter for search. The old title
// ("They owe you. We go after it.") was debt-recovery only and carried no
// property terms at all, so tenancy and conveyancing searches had nothing to
// match on. Brand stays first to protect branded search.
const TITLE = 'Pandas LP | Debt recovery and property law in Nigeria'
const DESCRIPTION = 'Pandas LP is a licensed Nigerian law firm. Demand letters from ₦10,000, tenancy documents from ₦25,000, each signed by a practitioner before it is served.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Pandas LP' },
  description: DESCRIPTION,
  // The debt terms are kept exactly as they were so existing ranking signals
  // are not disturbed; the property terms are additions, not replacements.
  keywords: [
    'debt recovery Nigeria',
    'letter of demand Nigeria',
    'small claims court Lagos',
    'fast debt recovery Nigeria',
    'recover unpaid invoice Nigeria',
    'notice to quit Lagos',
    'recovery of premises Lagos',
    'tenancy agreement Nigeria',
    'deed of assignment Nigeria',
    'property lawyer Lagos',
  ],
  icons: {
    icon: '/favicon.png',
    // iOS Safari's "Add to Home Screen" ignores the Web Manifest's icons entirely — it only
    // ever looks for an apple-touch-icon link, so this is required (not redundant with
    // manifest.ts's icons array) for the home-screen icon to be right on iPhone/iPad.
    apple: '/icons/192',
  },
  // appleWebApp is the other half of iOS support — without capable: true, "Add to Home
  // Screen" still works but opens inside Safari's chrome (address bar, tab strip) instead
  // of as a standalone app window.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pandas LP',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: SITE_URL,
    siteName: 'Pandas LP',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
}

// Split out of `metadata` per Next's viewport/themeColor API (moved out of the metadata
// object in Next 14+) — this is what colors the Android status bar / task switcher when the
// app is installed, matching the manifest's own theme_color. One per theme; the theme script
// (lib/theme.ts) rewrites both when the visitor picks a theme that differs from the device.
// The site starts dark for everyone (lib/theme.ts), so the bar starts dark too; the theme
// script rewrites it when a visitor picks light.
export const viewport = {
  themeColor: THEME_COLOR.dark,
}

const legalServiceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LegalService',
  name: 'Pandas LP',
  legalName: 'Pandas LP',
  identifier: 'CAC BN 9646741',
  url: SITE_URL,
  logo: `${SITE_URL}/logo-mark.png`,
  image: `${SITE_URL}/logo-mark.png`,
  telephone: '+234 811 808 0189',
  email: 'pandaslegalpractitioners@gmail.com',
  description: DESCRIPTION,
  areaServed: { '@type': 'Country', name: 'Nigeria' },
  address: {
    '@type': 'PostalAddress',
    streetAddress: '3B Elegba Festival Drive, Oniru',
    addressLocality: 'Victoria Island, Lagos',
    addressRegion: 'Lagos',
    addressCountry: 'NG',
  },
  priceRange: '₦₦',
}

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the theme script sets data-theme on <html> before React loads,
    // so the server's <html> legitimately differs from the browser's on that one attribute.
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(legalServiceJsonLd) }}
        />
        {GA_MEASUREMENT_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
