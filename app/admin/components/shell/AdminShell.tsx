'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useFocusTrap } from '@/lib/useFocusTrap'
import AdminSidebar from './AdminSidebar'
import AdminTopbar from './AdminTopbar'
import { AdminShellContext, type AdminShellContextValue } from './AdminShellContext'
import { SECTION_LABELS, FINANCE_SUB_LABELS, parseFinanceSub, parseSection } from './adminSections'
import styles from './AdminShell.module.css'

// The frame around every admin page: navy sidebar, sticky top bar, content area. Rendered by
// app/admin/layout.tsx, so /admin and /admin/health share it. Owns the one "signed in?" check
// for the admin — whether the person is STAFF is still decided by the server on every
// /api/admin/* call (lib/adminAuth.ts); pages report a 403 through denyAccess().
export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [session, setSession] = useState<{ userId: string; userEmail: string | null } | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [topbarMeta, setTopbarMeta] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        router.replace('/')
        return
      }
      setSession({ userId: s.user.id, userEmail: s.user.email ?? null })
    })
  }, [router])

  const onHealthPage = pathname === '/admin/health'
  const activeSection = onHealthPage ? null : parseSection(searchParams.get('section'), Boolean(searchParams.get('caseId')))
  const activeFinanceSub = parseFinanceSub(searchParams.get('sub'))
  const title = onHealthPage
    ? 'System Health'
    : activeSection === 'finance' && activeFinanceSub !== 'overview'
      ? `Finance · ${FINANCE_SUB_LABELS[activeFinanceSub]}`
      : SECTION_LABELS[activeSection ?? 'overview']

  // A stale "12 cases loaded" shouldn't follow you onto Finance — each page sets its own.
  const sectionKey = `${pathname}?${searchParams.get('section') ?? ''}`
  useEffect(() => {
    setTopbarMeta(null)
    setMenuOpen(false)
  }, [sectionKey])

  // Mobile drawer: Escape closes it, focus stays inside while open, and returns to the
  // menu button afterwards.
  useFocusTrap(sidebarRef, menuOpen)
  useEffect(() => {
    if (!menuOpen) return
    menuButtonFocusRef.current = document.activeElement as HTMLElement | null
    sidebarRef.current?.querySelector<HTMLElement>('a[href]')?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      menuButtonFocusRef.current?.focus()
    }
  }, [menuOpen])

  const ctx = useMemo<AdminShellContextValue | null>(
    () =>
      session && {
        userId: session.userId,
        userEmail: session.userEmail,
        setTopbarMeta,
        denyAccess: () => setAccessDenied(true),
      },
    [session],
  )

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (!ctx) return null

  if (accessDenied) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-0)',
          color: 'var(--text-1)',
          padding: 24,
        }}
      >
        <div className="card" style={{ maxWidth: 420, textAlign: 'center', padding: '36px 28px' }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 24 }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
            This command center is restricted to authorized Pandas LP legal practitioners and staff.
          </p>
          <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>
            Return to Client Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <AdminShellContext.Provider value={ctx}>
      <div className={styles.shell}>
        <AdminSidebar
          ref={sidebarRef}
          activeSection={activeSection}
          activeFinanceSub={activeFinanceSub}
          onHealthPage={onHealthPage}
          userEmail={ctx.userEmail}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onSignOut={handleSignOut}
        />
        {menuOpen && <div className={styles.backdrop} onClick={() => setMenuOpen(false)} aria-hidden="true" />}

        <div className={styles.content}>
          <AdminTopbar title={title} meta={topbarMeta} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
          <main className={styles.main}>{children}</main>
        </div>
      </div>
    </AdminShellContext.Provider>
  )
}
