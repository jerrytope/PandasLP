'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PandasLogoMark } from './PandasLogo'
import ThemeToggle from './ThemeToggle'

/* Every prop is optional. The homepage passes real handlers; other pages get
   navigation defaults so nothing in the bar is dead. */
export default function Navbar({
  onLogoClick = null,
  onNavServices = null,
  onStartLawyerConsult = null,
  user = null,
  onAuthClick = null,
}) {
  const router = useRouter()
  onLogoClick = onLogoClick || (() => router.push('/'))
  onNavServices = onNavServices || (() => router.push('/agents'))
  onStartLawyerConsult = onStartLawyerConsult || (() => router.push('/agent/lawyer-consultation'))
  onAuthClick = onAuthClick || (() => router.push('/?signin=1'))
  const [scrolled, setScrolled]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  function closeMenu() { setMenuOpen(false) }

  return (
    <>
      <header className={`navbar${scrolled ? ' scrolled' : ''}`} role="banner">
        <div className="navbar-inner">

          {/* Logo */}
          <button
            type="button"
            className="nav-logo"
            onClick={() => { onLogoClick?.(); closeMenu(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label="Pandas LP home"
          >
            <PandasLogoMark size={28} />
            <span aria-hidden="true" style={{ width: 1, height: 25, background: 'var(--border-focus)' }} />
            <span style={{ display: 'block', textAlign: 'left' }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-display), Georgia, serif', fontSize: 16, fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1, color: 'var(--text-1)' }}>
                PANDAS
              </span>
              <span style={{ display: 'block', fontFamily: 'var(--font-mono), monospace', fontSize: 7, letterSpacing: '0.3em', color: 'var(--text-3)', marginTop: 3 }}>
                LEGAL PRACTITIONERS
              </span>
            </span>
          </button>

          {/* Desktop nav links */}
          <nav aria-label="Main navigation">
            <ul className="nav-links">
              <li><a href="#how-it-works" onClick={closeMenu}>How It Works</a></li>
              <li><a href="#pricing"      onClick={closeMenu}>Fees</a></li>
              <li><Link href="/blog"      onClick={closeMenu}>Resources</Link></li>
              <li><Link href="/agents" onClick={closeMenu}>Legal Agents</Link></li>
            </ul>
          </nav>

          {/* Desktop actions */}
          <div className="nav-actions">
            {user ? (
              <Link href="/dashboard" className="btn btn-ghost btn-sm">My Cases</Link>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onAuthClick?.(); closeMenu(); }}>
                Sign In
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { onNavServices?.(); closeMenu(); }}
              style={{ fontWeight: 700 }}
            >
              Start a Case
            </button>
          </div>

          <div className="nav-end">
            <ThemeToggle />

            {/* Mobile hamburger */}
            <button
              type="button"
              className={`hamburger${menuOpen ? ' open' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile full-screen overlay */}
      <nav
        className={`mobile-menu${menuOpen ? ' open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
      >
        <a href="#how-it-works" onClick={closeMenu}>How It Works</a>
        <a href="#pricing"      onClick={closeMenu}>Fees</a>
        <Link href="/blog"      onClick={closeMenu}>Resources</Link>
        <Link href="/agents" onClick={closeMenu}>Legal Agents</Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32, padding: '0 24px', width: '100%', maxWidth: 280 }}>
          {user ? (
            <Link href="/dashboard" className="btn btn-primary" onClick={closeMenu} style={{ justifyContent: 'center' }}>
              My Cases
            </Link>
          ) : (
            <>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { onNavServices?.(); closeMenu(); }}>
                Start a Case
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { onAuthClick?.(); closeMenu(); }}>
                Sign In
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  )
}
