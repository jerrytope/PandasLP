'use client'

import Link from 'next/link'
import { ArrowRight, ListChecks, Users, Wallet } from 'lucide-react'
import AdminStatsOverview from './AdminStatsOverview'
import { sectionHref } from './shell/adminSections'
import type { AdminCaseRow } from './types'

interface AdminOverviewProps {
  /** All live cases — the same data the Action Queue loads (see loadTab in app/admin/page.tsx). */
  cases: AdminCaseRow[]
  loading: boolean
  /** A KPI card was clicked: open All Matters filtered to that status. */
  onSelectFilter: (status: string) => void
}

// The admin's home section. The KPI cards used to sit above every tab and counted whatever
// that tab had loaded (so filtering All Matters changed them); here they always count all
// live cases.
export default function AdminOverview({ cases, loading, onSelectFilter }: AdminOverviewProps) {
  const awaitingReview = cases.filter((c) => c.status === 'paid' && !c.reviewed_at && !c.is_test).length

  const shortcuts = [
    {
      href: sectionHref('queue'),
      icon: ListChecks,
      label: 'Action Queue',
      detail: awaitingReview > 0 ? `${awaitingReview} paid matter${awaitingReview === 1 ? '' : 's'} awaiting review` : 'Nothing waiting on review',
    },
    { href: sectionHref('leads'), icon: Users, label: 'Leads', detail: 'Debt checks and consent records' },
    { href: sectionHref('finance'), icon: Wallet, label: 'Finance', detail: 'Revenue, invoices and billing settings' },
  ]

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {loading && cases.length === 0 ? (
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading matters…</p>
      ) : (
        <AdminStatsOverview cases={cases} onSelectFilter={onSelectFilter} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        {shortcuts.map(({ href, icon: Icon, label, detail }) => (
          <Link
            key={label}
            href={href}
            className="card"
            style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none', color: 'var(--text-1)' }}
          >
            <Icon size={20} strokeWidth={1.8} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden="true" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{label}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{detail}</span>
            </span>
            <ArrowRight size={16} strokeWidth={1.8} style={{ color: 'var(--text-3)' }} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  )
}
