'use client'

import { useState } from 'react'
import { formatDate, type WaitlistRow } from './types'
import { Search, Download, Users, Mail, Clock } from 'lucide-react'

interface AdminWaitlistViewProps {
  signups: WaitlistRow[]
  loading: boolean
}

export default function AdminWaitlistView({ signups, loading }: AdminWaitlistViewProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = signups.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return s.email.toLowerCase().includes(q) || s.service.toLowerCase().includes(q)
  })

  function handleExportCsv() {
    if (filtered.length === 0) return

    const headers = ['Email', 'Service Requested', 'Signed Up Date']
    const rows = filtered.map((s) => [s.email, `"${s.service}"`, new Date(s.created_at).toISOString()])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `pandas-waitlist-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search & Export Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 380 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            className="input"
            placeholder="Search waitlist emails or services…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 38, minHeight: 40, fontSize: 13 }}
          />
        </div>

        <button
          type="button"
          className="btn btn-sm"
          onClick={handleExportCsv}
          disabled={filtered.length === 0}
        >
          <Download size={14} />
          <span>Export Waitlist CSV</span>
        </button>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
        Total leads: <strong>{filtered.length}</strong>
      </div>

      {loading && <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '32px 0' }}>Loading waitlist…</p>}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
          <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>No waitlist entries found</div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div
          className="card"
          style={{
            padding: 0,
            overflowX: 'auto',
            background: 'var(--bg-2)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-2)' }}>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Email Address</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Requested Service</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>Signup Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="table-row-hover">
                  <td style={{ padding: '12px 18px', fontWeight: 500, color: 'var(--text-1)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={13} style={{ color: 'var(--text-3)' }} /> {s.email}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span className="badge" style={{ background: 'var(--bg-1)', color: 'var(--accent)' }}>
                      {s.service}
                    </span>
                  </td>
                  <td style={{ padding: '12px 18px', color: 'var(--text-3)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} /> {formatDate(s.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
