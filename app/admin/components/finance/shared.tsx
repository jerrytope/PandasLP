'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import type { BillingSettings, InvoiceStatus } from '@/lib/invoices'
import { INVOICE_STATUS_LABEL } from '@/lib/invoices'

// Series colours for finance charts, validated with the dataviz skill's palette checker against
// the white card surface (light mode; the admin has no dark theme): CVD separation ΔE 27.4,
// normal-vision ΔE 30.4, both >= 3:1 contrast. Fixed order: fees first, invoices second.
export const SERIES = { fees: '#2a78d6', invoices: '#B8860B' } as const

export function compactNaira(kobo: number): string {
  const n = kobo / 100
  if (Math.abs(n) >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (Math.abs(n) >= 1_000) return `₦${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}K`
  return `₦${Math.round(n).toLocaleString('en-NG')}`
}

export function usd(n: number | null | undefined, digits = 2): string {
  if (n == null) return '—'
  return `$${n.toFixed(digits)}`
}

export function longDate(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const STATUS_STYLE: Record<InvoiceStatus, { bg: string; fg: string }> = {
  draft: { bg: 'var(--bg-1)', fg: 'var(--text-2)' },
  sent: { bg: 'rgba(42, 120, 214, 0.10)', fg: '#1d5fae' },
  part_paid: { bg: 'rgba(184, 134, 11, 0.12)', fg: '#8a6508' },
  paid: { bg: 'rgba(22, 128, 61, 0.10)', fg: '#16803d' },
  void: { bg: 'var(--bg-1)', fg: 'var(--text-3)' },
}

export function InvoiceStatusBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  const s = overdue ? { bg: 'rgba(179, 64, 46, 0.10)', fg: 'var(--danger)' } : STATUS_STYLE[status]
  return (
    <span className="badge" style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, textDecoration: status === 'void' ? 'line-through' : 'none' }}>
      {overdue ? 'Overdue' : INVOICE_STATUS_LABEL[status]}
    </span>
  )
}

export function useBillingSettings() {
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const [error, setError] = useState('')
  async function reload() {
    try {
      const res = await authedFetch('/api/admin/settings/billing')
      const data = await res.json()
      if (!res.ok || data.error) setError(data.error || 'Could not load billing settings.')
      else setSettings(data.settings)
    } catch {
      setError('Network error while loading billing settings.')
    }
  }
  useEffect(() => {
    reload()
  }, [])
  return { settings, setSettings, error, reload }
}

export const fieldStyle: React.CSSProperties = { display: 'grid', gap: 4, fontSize: 13 }
export const mutedText: React.CSSProperties = { color: 'var(--text-3)', fontSize: 12, margin: 0 }
