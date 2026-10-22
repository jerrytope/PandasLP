'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { PandasLogoMark } from './PandasLogo'
import { STATES } from '@/lib/locations'
import { LAGOS_DISTRICTS } from '@/lib/lagosDistricts'
import { LAGOS_PROPERTY_DISTRICTS } from '@/lib/lagosPropertyDistricts'
import { CONSENT_TEXT } from '@/lib/consent'
import { LIVE_PRACTICES, FIRM } from '@/lib/sitePractices'
import styles from './site/site.module.css'

/* The site footer ("Ink & Brass"): four short columns, the firm's details stated exactly, and
   the location pages folded into one "Locations" list (they matter for search, not for reading). */
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
    <footer className={styles.footer} id="contact">
      <div className="container" style={{ maxWidth: 'var(--max-width)', padding: '0 var(--gutter)' }}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <PandasLogoMark size={28} />
              <span className={styles.wordmark}>Pandas <span>LP</span></span>
            </div>
            <p>Debt recovery and property law in Nigeria. Drafted by our agents, reviewed and signed by a licensed practitioner before anything is served or filed.</p>

            <div className={styles.newsletter}>
              <span className="field-label" style={{ margin: 0 }}>Legal notes for Nigerian businesses</span>
              {sent ? (
                <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)', margin: 0 }}>
                  <Check size={14} strokeWidth={2} aria-hidden="true" /> You’re subscribed
                </p>
              ) : (
                <form className={styles.newsletterRow} onSubmit={handleSubscribe} noValidate>
                  <input
                    type="email"
                    className="input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email for legal notes"
                    autoComplete="email"
                    required
                  />
                  <button type="submit" className="btn btn-outline btn-sm" disabled={!email || busy}>{busy ? 'Saving…' : 'Subscribe'}</button>
                </form>
              )}
              {!sent && (
                <p className={styles.newsletterNote}>
                  {CONSENT_TEXT.newsletter_v1} <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy policy</Link>
                </p>
              )}
              {error && <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)', margin: 0 }}>{error}</p>}
            </div>
          </div>

          <nav className={styles.footerCol} aria-label="Practice">
            <h2>Practice</h2>
            <ul>
              {LIVE_PRACTICES.map((p) => <li key={p.slug}><Link href={p.href}>{p.name}</Link></li>)}
              <li><Link href="/agents">Opening later</Link></li>
              <li><Link href="/debt-check">Free debt check</Link></li>
              <li><Link href="/#fees">Fees</Link></li>
            </ul>
          </nav>

          <nav className={styles.footerCol} aria-label="Businesses">
            <h2>Businesses</h2>
            <ul>
              <li><Link href="/businesses">Loan recovery for lenders</Link></li>
              <li><Link href="/developers/api">Borrower API</Link></li>
              <li><Link href="/blog">Notes</Link></li>
            </ul>
          </nav>

          <nav className={styles.footerCol} aria-label="Firm">
            <h2>Firm</h2>
            <ul>
              <li><Link href="/how-we-work">How we work</Link></li>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/dashboard">My matters</Link></li>
              <li><a href={FIRM.phoneHref}>{FIRM.phone}</a></li>
              <li><a href={`mailto:${FIRM.email}`} style={{ wordBreak: 'break-all' }}>{FIRM.email}</a></li>
              <li className={styles.footerMuted}>{FIRM.address[0]}<br />{FIRM.address[1]}</li>
            </ul>
          </nav>

          <nav className={styles.footerCol} aria-label="Legal">
            <h2>Legal</h2>
            <ul>
              <li><Link href="/terms">Terms of use</Link></li>
              <li><Link href="/privacy">Privacy policy</Link></li>
              <li><Link href="/refund-policy">Refund policy</Link></li>
            </ul>
          </nav>
        </div>

        <details className={styles.locations}>
          <summary>Locations</summary>
          <div className={styles.locationGroups}>
            <div>
              <h3>Recover a debt, by state</h3>
              <div>{STATES.map((s) => <Link key={s.slug} href={`/recover-debt/${s.slug}`}>{s.name}</Link>)}</div>
            </div>
            <div>
              <h3>Debt recovery in Lagos</h3>
              <div>{LAGOS_DISTRICTS.map((d) => <Link key={d.slug} href={`/recover-debt/lagos/${d.slug}`}>{d.name}</Link>)}</div>
            </div>
            <div>
              <h3>Recovery of premises in Lagos</h3>
              <div>{LAGOS_PROPERTY_DISTRICTS.map((d) => <Link key={d.slug} href={`/recover-premises/lagos/${d.slug}`}>{d.name}</Link>)}</div>
            </div>
          </div>
        </details>

        <div className={styles.footerBottom}>
          <div className={styles.credentials}>
            <span>{FIRM.registration}</span>
            <span>Registered business name</span>
            <span>Signed by a licensed practitioner</span>
          </div>
          <span className={styles.footerMuted}>© {new Date().getFullYear()} {FIRM.name}</span>
        </div>
        <p className={styles.disclaimer}>
          Pandas LP ({FIRM.registration}) is a CAC-registered business and law firm. A guided digital interview prepares legal
          documents from the firm’s Nigerian templates; each is reviewed by our legal team before it is served or filed. For
          matters that need a licensed legal practitioner to advise, file or appear in court, our lawyers handle them on your behalf.
        </p>
      </div>
    </footer>
  )
}
