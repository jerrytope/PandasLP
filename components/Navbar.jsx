'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Menu, X } from 'lucide-react'
import { PandasLogoMark } from './PandasLogo'
import ThemeToggle from './ThemeToggle'
import { AnnouncementBar } from './ui'
import { LIVE_PRACTICES, OPENING_LATER } from '@/lib/sitePractices'
import styles from './site/site.module.css'

/* The site header ("Ink & Brass", docs/frontend-revamp-plan.md): fixed, with the Practice
   mega-menu, the announcement bar (when a page passes one from Admin → Site content) and a
   full-screen drawer on small screens.

   Every prop is optional. The homepage passes real handlers; other pages get navigation
   defaults so nothing in the bar is dead. The header's real height is published as
   --site-header-h, and (unless spacer is false) a spacer of that height follows it, so the
   page starts right under the header whatever is in it. */
export default function Navbar({
  onLogoClick = null,
  onNavServices = null,
  onStartLawyerConsult = null,
  user = null,
  onAuthClick = null,
  announcement = null,
  spacer = true,
}) {
  const router = useRouter()
  onLogoClick = onLogoClick || (() => router.push('/'))
  onNavServices = onNavServices || (() => router.push('/agents'))
  onStartLawyerConsult = onStartLawyerConsult || (() => router.push('/agent/lawyer-consultation'))
  onAuthClick = onAuthClick || (() => router.push('/?signin=1'))

  const headerRef = useRef(null)
  const megaRef = useRef(null)
  const practiceButtonRef = useRef(null)
  const [megaOpen, setMegaOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Publish the header's height so pages can sit right under it, announcement or not.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--site-header-h', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // Escape closes either menu; a click outside closes the mega-menu.
  useEffect(() => {
    if (!megaOpen && !menuOpen) return
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (megaOpen) { setMegaOpen(false); practiceButtonRef.current?.focus() }
      setMenuOpen(false)
    }
    function onClick(e) {
      if (megaOpen && headerRef.current && !headerRef.current.contains(e.target)) setMegaOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [megaOpen, menuOpen])

  function close() {
    setMegaOpen(false)
    setMenuOpen(false)
  }

  return (
    <>
      <header ref={headerRef} className={styles.header}>
        {announcement && <AnnouncementBar label={announcement.label} text={announcement.text} href={announcement.href || undefined} />}
        <div className={styles.bar}>
          <button type="button" className={styles.logo} onClick={() => { onLogoClick?.(); close() }} aria-label="Pandas LP home">
            <PandasLogoMark size={26} />
            <span className={styles.wordmark}>Pandas <span>LP</span></span>
          </button>

          <nav className={styles.nav} aria-label="Main navigation">
            <button
              ref={practiceButtonRef}
              type="button"
              className={styles.navItem}
              aria-expanded={megaOpen}
              aria-controls="practice-menu"
              onClick={() => setMegaOpen((v) => !v)}
            >
              Practice <ChevronDown className={styles.chev} size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            <Link className={styles.navItem} href="/businesses" onClick={close}>For businesses</Link>
            <Link className={styles.navItem} href="/#fees" onClick={close}>Fees</Link>
            <Link className={styles.navItem} href="/how-we-work" onClick={close}>How we work</Link>
            <Link className={styles.navItem} href="/blog" onClick={close}>Notes</Link>
          </nav>

          <div className={styles.actions}>
            <ThemeToggle />
            <button type="button" className={`${styles.textAction} ${styles.hideMobile}`} onClick={() => { onStartLawyerConsult?.(); close() }}>
              Talk to a lawyer
            </button>
            {user ? (
              <Link href="/dashboard" className={`btn btn-outline btn-sm ${styles.hideMobile}`} onClick={close}>My matters</Link>
            ) : (
              <button type="button" className={`${styles.textAction} ${styles.hideMobile}`} onClick={() => { onAuthClick?.(); close() }}>Sign in</button>
            )}
            <button type="button" className={`btn btn-primary btn-sm ${styles.hideMobile}`} onClick={() => { onNavServices?.(); close() }}>
              Start a matter
            </button>
            <button
              type="button"
              className={styles.burger}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              {menuOpen ? <X size={18} strokeWidth={1.8} aria-hidden="true" /> : <Menu size={18} strokeWidth={1.8} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {megaOpen && (
          <div ref={megaRef} id="practice-menu" className={styles.mega}>
            <div className={styles.megaInner}>
              <div>
                <div className={styles.megaLabel}>Open now</div>
                <div className={styles.megaLive}>
                  {LIVE_PRACTICES.map((p) => (
                    <Link key={p.slug} href={p.href} className={styles.megaLink} onClick={close}>
                      <span className={styles.megaLinkHead}>
                        <strong>{p.name}</strong>
                        <span className={styles.megaPrice}>{p.price}</span>
                      </span>
                      <span className={styles.megaLine}>{p.line}</span>
                      <span className={styles.megaDocs}>{p.documents.join(' · ')}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div className={styles.megaLabel}>Written and priced, opening later</div>
                <ul className={styles.megaLater}>
                  {OPENING_LATER.map((p) => (
                    <li key={p.name}><strong>{p.name}</strong><span>{p.line}</span></li>
                  ))}
                </ul>
              </div>
              <div className={styles.megaAside}>
                <div className={styles.megaLabel}>Not sure where to start?</div>
                <p>Seven quick questions show how strong a debt claim looks and what it would cost.</p>
                <Link href="/debt-check?ref=nav" onClick={close}>Take the free debt check →</Link>
                <Link href="/agents" onClick={close}>See every practice →</Link>
              </div>
            </div>
          </div>
        )}
      </header>
      {spacer && <div aria-hidden="true" style={{ height: 'var(--site-header-h, 64px)' }} />}

      {menuOpen && (
        <nav id="mobile-menu" className={styles.drawer} aria-label="Mobile navigation">
          {LIVE_PRACTICES.map((p) => (
            <Link key={p.slug} href={p.href} onClick={close}>{p.name}</Link>
          ))}
          <Link href="/agents" className={styles.drawerSub} onClick={close}>Every practice, including those opening later</Link>
          <Link href="/businesses" onClick={close}>For businesses</Link>
          <Link href="/#fees" onClick={close}>Fees</Link>
          <Link href="/how-we-work" onClick={close}>How we work</Link>
          <Link href="/blog" onClick={close}>Notes</Link>
          <div className={styles.drawerActions}>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { onNavServices?.(); close() }}>Start a matter</button>
            <button type="button" className="btn btn-outline btn-lg" onClick={() => { onStartLawyerConsult?.(); close() }}>Talk to a lawyer</button>
            {user ? (
              <Link href="/dashboard" className="btn btn-ghost" onClick={close}>My matters</Link>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => { onAuthClick?.(); close() }}>Sign in</button>
            )}
          </div>
        </nav>
      )}
    </>
  )
}
