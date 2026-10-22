'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { Check, X, RefreshCw } from 'lucide-react'
import { useAdminShell } from '../components/shell/AdminShellContext'

interface HealthCheck {
  key: string
  label: string
  ok: boolean
  detail: string
}

interface HealthResponse {
  env: string
  checked_at: string
  all_ok: boolean
  checks: HealthCheck[]
}

export default function AdminHealthPage() {
  // Signed-in check, header and "Access Restricted" screen come from the shell (app/admin/layout.tsx).
  const { denyAccess } = useAdminShell()
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const res = await authedFetch('/api/admin/health')
      if (res.status === 403) {
        denyAccess()
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setLoadError(json.error || 'Failed to load health check.')
        return
      }
      setData(json)
    } catch {
      setLoadError('Network error while loading health check.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span className="label-mono">Production config</span>
        <button type="button" className="btn btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} strokeWidth={2} style={{ marginRight: 6 }} aria-hidden="true" />
          {loading ? 'Checking…' : 'Recheck'}
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
        Presence/placeholder checks only — never shows the actual secret values. Answers "is
        production actually configured?" without digging through the Vercel dashboard by hand.
      </p>

      {loadError && (
        <div className="bubbleError" style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 12, background: 'rgba(var(--danger-rgb), 0.12)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 14 }}>
          {loadError}
        </div>
      )}

      {data && (
        <>
          <div
            className="card"
            style={{
              marginBottom: 24,
              borderColor: data.all_ok ? 'var(--secondary)' : 'var(--warning)',
              background: data.all_ok ? 'var(--secondary-soft)' : 'rgba(var(--caution-rgb), 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              {data.all_ok ? <Check size={18} color="var(--secondary)" /> : <X size={18} color="var(--warning)" />}
              <strong style={{ fontSize: 15 }}>
                {data.all_ok ? 'All checks passing' : 'Something needs attention'}
              </strong>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Environment: <strong>{data.env}</strong> · Checked {new Date(data.checked_at).toLocaleString()}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.checks.map((c) => (
              <div
                key={c.key}
                className="card"
                style={{
                  padding: '14px 18px',
                  borderColor: c.ok ? 'var(--border-subtle)' : 'var(--danger)',
                  background: c.ok ? 'var(--bg-1)' : 'rgba(var(--danger-rgb), 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  {c.ok ? (
                    <Check size={16} color="var(--secondary)" style={{ marginTop: 2, flexShrink: 0 }} />
                  ) : (
                    <X size={16} color="var(--danger)" style={{ marginTop: 2, flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
