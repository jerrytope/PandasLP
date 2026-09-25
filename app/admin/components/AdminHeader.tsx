'use client'

import Link from 'next/link'
import { Activity, Shield, ExternalLink } from 'lucide-react'

interface AdminHeaderProps {
  userEmail?: string | null
  casesCount?: number
}

export default function AdminHeader({ userEmail, casesCount }: AdminHeaderProps) {
  return (
    <header className="navbar" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-2)' }}>
      <div className="container navbar-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" className="logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Pandas <span className="accent">LP</span></span>
            <span
              className="badge"
              style={{
                background: 'var(--accent-glow-soft)',
                color: 'var(--accent)',
                borderColor: 'var(--accent-glow)',
                fontSize: 10,
                padding: '2px 8px',
                fontWeight: 600,
                letterSpacing: '0.08em',
              }}
            >
              ADMIN
            </span>
          </Link>

          {typeof casesCount === 'number' && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-3)',
                paddingLeft: 12,
                borderLeft: '1px solid var(--border-subtle)',
              }}
            >
              {casesCount} cases loaded
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {userEmail && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-2)',
                display: 'none',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-1)',
              }}
              className="user-badge"
            >
              <Shield size={12} strokeWidth={2} style={{ color: 'var(--accent)' }} />
              {userEmail}
            </span>
          )}

          <Link
            href="/admin/health"
            className="btn btn-sm"
            style={{ fontSize: 13, gap: 6, padding: '8px 14px' }}
            title="Inspect production API keys and infrastructure status"
          >
            <Activity size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
            <span>Health</span>
          </Link>

          <Link
            href="/dashboard"
            className="btn btn-sm"
            style={{ fontSize: 13, gap: 6, padding: '8px 14px' }}
            title="Go to client dashboard"
          >
            <span>My Cases</span>
            <ExternalLink size={12} strokeWidth={1.8} style={{ color: 'var(--text-muted)' }} />
          </Link>
        </div>
      </div>
    </header>
  )
}
