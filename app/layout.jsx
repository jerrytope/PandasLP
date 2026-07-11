import { Bricolage_Grotesque, Inter, DM_Mono } from 'next/font/google'
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

export const metadata = {
  title: 'Pandas LP — They owe you money. We\'ll get it back.',
  description: 'AI drafts the demand letter, real lawyers take it to court. Nigeria\'s first AI-native law firm. From ₦10,000.',
  icons: { icon: '/favicon.png' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
