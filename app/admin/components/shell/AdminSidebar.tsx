'use client'

import Link from 'next/link'
import { forwardRef } from 'react'
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Briefcase,
  Building2,
  FileQuestion,
  Wallet,
  ClipboardList,
  PanelsTopLeft,
  Activity,
  ExternalLink,
  Shield,
  LogOut,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  ADMIN_SECTIONS,
  FINANCE_SUBS,
  FINANCE_SUB_LABELS,
  SECTION_LABELS,
  sectionHref,
  type AdminSection,
  type FinanceSub,
} from './adminSections'
import styles from './AdminShell.module.css'

const SECTION_ICONS: Record<AdminSection, LucideIcon> = {
  overview: LayoutDashboard,
  queue: ListChecks,
  leads: Users,
  matters: Briefcase,
  brands: Building2,
  claims: FileQuestion,
  finance: Wallet,
  waitlist: ClipboardList,
  site: PanelsTopLeft,
}

interface AdminSidebarProps {
  /** The section showing, or null on a page that isn't a section (e.g. /admin/health). */
  activeSection: AdminSection | null
  activeFinanceSub: FinanceSub
  onHealthPage: boolean
  userEmail: string | null
  /** Mobile drawer state; ignored on desktop where the sidebar is always shown. */
  open: boolean
  onClose: () => void
  onSignOut: () => void
}

const AdminSidebar = forwardRef<HTMLElement, AdminSidebarProps>(function AdminSidebar(
  { activeSection, activeFinanceSub, onHealthPage, userEmail, open, onClose, onSignOut },
  ref,
) {
  return (
    <aside
      ref={ref}
      id="admin-sidebar"
      className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}
      aria-label="Admin navigation"
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link href="/admin" className={styles.brand} style={{ flex: 1 }} onClick={onClose}>
          <span>
            Pandas <span className={styles.brandAccent}>LP</span>
          </span>
          <span className={styles.adminBadge}>ADMIN</span>
        </Link>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close menu" style={{ marginRight: 12 }}>
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <nav className={styles.nav} aria-label="Admin sections">
        {ADMIN_SECTIONS.map((section) => {
          const Icon = SECTION_ICONS[section]
          const isActive = activeSection === section
          return (
            <div key={section}>
              <Link
                href={sectionHref(section)}
                className={styles.navItem}
                aria-current={isActive && (section !== 'finance' || activeFinanceSub === 'overview') ? 'page' : undefined}
                onClick={onClose}
              >
                <Icon size={17} strokeWidth={1.8} className={styles.navIcon} aria-hidden="true" />
                {SECTION_LABELS[section]}
              </Link>

              {section === 'finance' && isActive && (
                <div className={styles.subNav}>
                  {FINANCE_SUBS.filter((s) => s !== 'overview').map((sub) => (
                    <Link
                      key={sub}
                      href={sectionHref('finance', sub)}
                      className={styles.navItem}
                      aria-current={activeFinanceSub === sub ? 'page' : undefined}
                      onClick={onClose}
                    >
                      {FINANCE_SUB_LABELS[sub]}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <div className={styles.navGroupLabel}>System</div>
        <Link
          href="/admin/health"
          className={styles.navItem}
          aria-current={onHealthPage ? 'page' : undefined}
          onClick={onClose}
          title="Inspect production API keys and infrastructure status"
        >
          <Activity size={17} strokeWidth={1.8} className={styles.navIcon} aria-hidden="true" />
          System Health
        </Link>
        <Link href="/dashboard" className={styles.navItem} onClick={onClose} title="Go to client dashboard">
          <ExternalLink size={17} strokeWidth={1.8} className={styles.navIcon} aria-hidden="true" />
          My Cases
        </Link>
      </nav>

      <div className={styles.sidebarFooter}>
        {userEmail && (
          <span className={styles.userEmail} title={userEmail}>
            <Shield size={13} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--nav-gold)', flexShrink: 0 }} />
            {userEmail}
          </span>
        )}
        <button type="button" className={styles.signOut} onClick={onSignOut}>
          <LogOut size={14} strokeWidth={2} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  )
})

export default AdminSidebar
