import { Bricolage_Grotesque, Inter, DM_Mono } from 'next/font/google'
import { safeJsonLd } from '@/lib/jsonLd'
import './globals.css'

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
})

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

const mono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'
const TITLE = 'Pandas LP — They owe you. We go after it.'
const DESCRIPTION = 'AI drafts the demand letter. A licensed lawyer serves it and, if needed, takes it to court. Nigeria\'s first AI-native law firm.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s — Pandas LP' },
  description: DESCRIPTION,
  keywords: [
    'debt recovery Nigeria',
    'letter of demand Nigeria',
    'small claims court Lagos',
    'AI law firm Nigeria',
    'recover unpaid invoice Nigeria',
  ],
  icons: { icon: '/favicon.png' },
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
        {children}
      </body>
    </html>
  )
}
