'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PandasLogoMark } from './PandasLogo'
import { STATES } from '@/lib/locations'
import { LAGOS_DISTRICTS } from '@/lib/lagosDistricts'
import { LAGOS_PROPERTY_DISTRICTS } from '@/lib/lagosPropertyDistricts'
import { Check } from 'lucide-react'
import { CONSENT_TEXT } from '@/lib/consent'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Saves the sign-up as a consent record (see app/api/newsletter). Only says "subscribed" once
  // the server has actually stored it.
  async function handleSubscribe(e) {
    e.preventDefault()
    if (!email || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, pageUrl: window.location.href }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setSent(true)
      setEmail('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <footer className="footer" id="contact" role="contentinfo">
      <div className="container">
        <div className="footer-grid">

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <PandasLogoMark size={32} />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.025em', color: 'var(--text-1)' }}>
                Pandas <span style={{ color: 'var(--accent)' }}>LP</span>
              </span>
            </div>
            <p className="footer-brand-tagline">
              Debt recovery and property law in Lagos. Every document is signed by a
              licensed practitioner before it is served or filed.
            </p>
            <div style={{ marginTop: 20 }}>
              <p className="field-label" style={{ marginBottom: 8 }}>Legal tips for Nigerian businesses</p>
              {sent ? (
                <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--secondary)', marginTop: 4 }}>
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                  You're subscribed
                </p>
              ) : (
                <form className="footer-newsletter" onSubmit={handleSubscribe} noValidate>
                  <input
                    type="email"
                    className="footer-newsletter-input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    aria-label="Email for newsletter"
                    autoComplete="email"
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!email || busy}>
                    {busy ? 'Saving…' : 'Subscribe'}
                  </button>
                </form>
              )}
              {!sent && (
                <p style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--text-3)', marginTop: 8, maxWidth: 340 }}>
                  {CONSENT_TEXT.newsletter_v1} <Link href="/privacy" style={{ color: 'inherit' }}>Privacy policy</Link>
                </p>
              )}
              {error && <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 6 }}>{error}</p>}
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="footer-col-title">Services</p>
            <nav className="footer-links" aria-label="Services links">
              <a href="#services">Debt Recovery</a>
              <a href="#services">Judgment Enforcement</a>
              <a href="#services">Recovery of Premises</a>
              <a href="#services">Contracts & Commercial</a>
              <a href="#services">CAC Registration</a>
              <a href="#services">Lawyer Consultation</a>
            </nav>
          </div>

          {/* Company */}
          <div>
            <p className="footer-col-title">Company</p>
            <nav className="footer-links" aria-label="Company links">
              <Link href="/debt-check">Free Debt Check</Link>
              <Link href="/blog">Legal Resources</Link>
              <a href="#how-it-works">How It Works</a>
              <a href="#pricing">Pricing</a>
              <Link href="/dashboard">My Cases</Link>
              <Link href="/terms">Terms of Use</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/refund-policy">Refund Policy</Link>
            </nav>

            <p className="footer-col-title" style={{ marginTop: 20 }}>Recover Debt By State</p>
            <nav className="footer-links" aria-label="Debt recovery by state links">
              {STATES.map((s) => (
                <Link key={s.slug} href={`/recover-debt/${s.slug}`}>{s.name}</Link>
              ))}
            </nav>

            <p className="footer-col-title" style={{ marginTop: 20 }}>Debt Recovery — Lagos Areas</p>
            <nav className="footer-links" aria-label="Debt recovery by Lagos area links">
              {LAGOS_DISTRICTS.map((d) => (
                <Link key={d.slug} href={`/recover-debt/lagos/${d.slug}`}>{d.name}</Link>
              ))}
            </nav>

            <p className="footer-col-title" style={{ marginTop: 20 }}>Recovery of Premises — Lagos Areas</p>
            <nav className="footer-links" aria-label="Recovery of premises by Lagos area links">
              {LAGOS_PROPERTY_DISTRICTS.map((d) => (
                <Link key={d.slug} href={`/recover-premises/lagos/${d.slug}`}>{d.name}</Link>
              ))}
            </nav>
          </div>

          {/* Contact */}
          <div>
            <p className="footer-col-title">Contact</p>
            <div className="footer-links">
              <a href="mailto:pandaslegalpractitioners@gmail.com" style={{ wordBreak: 'break-all' }}>
                pandaslegalpractitioners@gmail.com
              </a>
              <a href="tel:+2348118080189">+234 811 808 0189</a>
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>
                3B Elegba Festival Drive, Oniru<br />Victoria Island, Lagos
              </span>
            </div>
            <div style={{ marginTop: 20 }}>
              <span className="badge badge-accent" style={{ fontSize: 10 }}>
                CAC BN 9646741
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <p className="footer-disclaimer">
            Pandas LP (CAC BN 9646741) is a CAC-registered business and law firm. A guided digital
            interview prepares court-ready legal documents from Nigerian legal templates. For matters
            requiring a licensed legal practitioner to advise, file, or appear in court, our lawyers are
            available and handle all filings on your behalf. All documents are prepared for your
            use and are reviewed by our legal team before service or filing.
          </p>
          <p className="footer-copyright">
            © {new Date().getFullYear()} Pandas LP. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
