import Link from 'next/link'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'This page doesn\'t exist or has moved.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />

      <main
        className="container"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          paddingTop: 88,
          paddingBottom: 96,
        }}
      >
        <span className="label-mono" style={{ marginBottom: 16 }}>Error 404</span>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(64px,12vw,120px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: 'var(--accent)',
            margin: '0 0 20px',
          }}
        >
          404
        </h1>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(22px,3vw,32px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-1)',
            margin: '0 0 12px',
          }}
        >
          This page went quiet on us.
        </h2>

        <p
          style={{
            fontSize: 16,
            color: 'var(--text-muted)',
            lineHeight: 1.65,
            maxWidth: 440,
            margin: '0 0 40px',
          }}
        >
          The page you're looking for doesn't exist or has moved. Unlike a debtor who's gone
          quiet, this one we can't chase down for you.
        </p>

        <div className="row" style={{ justifyContent: 'center', marginBottom: 48 }}>
          <Link href="/" className="btn btn-primary">
            Back to homepage
          </Link>
          <Link href="/dashboard" className="btn btn-outline">
            My Cases
          </Link>
        </div>

        <nav aria-label="Quick links" className="row" style={{ justifyContent: 'center', gap: 20 }}>
          <a href="/#services" style={{ fontSize: 13, color: 'var(--text-2)' }}>Services</a>
          <a href="/#pricing" style={{ fontSize: 13, color: 'var(--text-2)' }}>Pricing</a>
          <Link href="/blog" style={{ fontSize: 13, color: 'var(--text-2)' }}>Legal Resources</Link>
          <a href="mailto:pandaslegalpractitioners@gmail.com" style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Contact
          </a>
        </nav>
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  )
}
