'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PandasLogoMark } from './PandasLogo'
import { STATES } from '@/lib/locations'
import { Check } from 'lucide-react'

export default function Footer() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubscribe(e) {
    e.preventDefault()
    if (email) { setSent(true); setEmail('') }
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
              They owe you. We go after it: demand letter today,
              real lawyers take it to court.
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
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!email}>
                    Subscribe
                  </button>
                </form>
              )}
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
          </div>

          {/* Contact */}
          <div>
            <p className="footer-col-title">Contact</p>
            <div className="footer-links">
              <a href="mailto:pandaslegalpractitioners@gmail.com" style={{ wordBreak: 'break-all' }}>
                pandaslegalpractitioners@gmail.com
              </a>
              <a href="tel:+2348118080189">+234 811 808 0189</a>
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Lagos, Nigeria</span>
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
