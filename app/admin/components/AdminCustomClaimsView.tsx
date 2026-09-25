'use client'

import { useState } from 'react'
import { formatNaira } from '@/lib/formatNaira'
import { formatDate, type CustomClaimRow } from './types'
import { AlertTriangle, Plus, Search, MessageSquare, Phone, Mail, Clock } from 'lucide-react'

interface AdminCustomClaimsViewProps {
  claims: CustomClaimRow[]
  loading: boolean
  onStartIntake: (seedPrompt: string) => void
}

export default function AdminCustomClaimsView({
  claims,
  loading,
  onStartIntake,
}: AdminCustomClaimsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredClaims = claims.filter((c) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      c.description.toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Action Header: Search & Offline Intake Launch */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            className="input"
            placeholder="Search custom claims by name, email, query…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 38, minHeight: 40, fontSize: 13 }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onStartIntake('')}
          title="Run Small Claims AI Agent on behalf of a walk-in or phone client"
        >
          <Plus size={15} strokeWidth={2} />
          <span>Start Offline Case With Agent</span>
        </button>
      </div>

      {loading && <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: '32px 0' }}>Loading claims…</p>}

      {!loading && filteredClaims.length === 0 && (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
          <MessageSquare size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>No custom claims found</div>
          <p style={{ fontSize: 13, marginTop: 4 }}>Custom submissions from the website will appear here.</p>
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredClaims.map((claim) => (
            <div
              key={claim.id}
              className="card"
              style={{
                padding: '20px 24px',
                borderLeft: !claim.notified ? '4px solid var(--danger)' : '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--text-1)' }}>
                    {claim.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Mail size={12} /> {claim.email}
                    </span>
                    {claim.phone && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={12} /> {claim.phone}
                      </span>
                    )}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-3)' }}>
                      <Clock size={12} /> {formatDate(claim.created_at)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!claim.notified && (
                    <span
                      className="badge badge-danger"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <AlertTriangle size={12} /> Needs Response
                    </span>
                  )}
                  <span className="badge" style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                    Paid {formatNaira(claim.amount_paid)}
                  </span>
                </div>
              </div>

              {/* Description body */}
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-1)',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: 'var(--text-1)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {claim.description}
              </div>

              {/* Work Claim Action */}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    onStartIntake(
                      `Here's what the client (${claim.name}, ${claim.email}${claim.phone ? `, ${claim.phone}` : ''}) told us in their own words:\n\n${claim.description}`,
                    )
                  }
                >
                  <MessageSquare size={13} strokeWidth={2} />
                  <span>Work This Matter With Agent</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
