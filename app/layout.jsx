import Script from 'next/script'
import { Instrument_Sans, Geist, Geist_Mono } from 'next/font/google'
import { MotionConfig } from 'framer-motion'
import { safeJsonLd } from '@/lib/jsonLd'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import './globals.css'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

const display = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
})

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'
const TITLE = 'Pandas LP | They owe you. We go after it.'
const DESCRIPTION = 'A licensed Lagos law firm that recovers what you\'re owed: demand letter today, court in 14 days if it\'s ignored.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Pandas LP' },
  description: DESCRIPTION,
  keywords: [
    'debt recovery Nigeria',
    'letter of demand Nigeria',
    'small claims court Lagos',
    'fast debt recovery Nigeria',
    'recover unpaid invoice Nigeria',
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
// app is installed, matching the manifest's own theme_color.
export const viewport = {
  themeColor: '#182A3A',
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
    addressLocality: 'Lagos',
    addressCountry: 'NG',
  },
  priceRange: '₦₦',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
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
