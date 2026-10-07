'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Clock } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'

interface SyncReport {
  code: string
  assigned: number
  drafted: number
  missing: number
  failed: number
  flagged: number
  skipped?: string
  error?: string
}

const INTERVALS = [
  { minutes: 15, label: 'Every 15 minutes' },
  { minutes: 30, label: 'Every 30 minutes' },
  { minutes: 60, label: 'Every hour' },
  { minutes: 120, label: 'Every 2 hours' },
  { minutes: 360, label: 'Every 6 hours' },
  { minutes: 1440, label: 'Once a day' },
]

function describe(r: SyncReport): string {
  if (r.skipped) return `${r.code}: skipped — ${r.skipped}`
  if (r.error) return `${r.code}: failed — ${r.error}`
  const parts = [
    r.assigned && `${r.assigned} new Case ID${r.assigned === 1 ? '' : 's'}`,
    r.drafted && `${r.drafted} letter${r.drafted === 1 ? '' : 's'} drafted`,
    r.missing && `${r.missing} missing documents`,
    r.failed && `${r.failed} failed (will retry)`,
    r.flagged && `${r.flagged} flagged`,
  ].filter(Boolean)
  return `${r.code}: ${parts.length ? parts.join(', ') : 'nothing new'}`
}

// The sheet sync's schedule and a "Sync now" button. The schedule itself is Vercel Cron
// (every 15 minutes) gated by this interval — see app/api/cron/brand-sheets.
export default function BrandSyncPanel({ onSynced }: { onSynced: () => void }) {
  const [interval, setIntervalMinutes] = useState<number | null>(null)
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string[] | null>(null)
  const [error, setError] = useState('')

  async function loadSettings() {
    const res = await authedFetch('/api/admin/brands/sync')
    if (!res.ok) return
    const data = await res.json()
    setIntervalMinutes(data.intervalMinutes)
    setLastRunAt(data.lastRunAt)
  }

  useEffect(() => {
    loadSettings().catch(() => {})
  }, [])

  async function syncNow() {
    setSyncing(true)
    setError('')
    setResult(null)
    try {
      const res = await authedFetch('/api/admin/brands/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Sync failed.')
      else setResult((data.reports as SyncReport[]).map(describe))
      await loadSettings()
      onSynced()
    } catch {
      setError('Network error — the sync may still be running. Refresh in a minute.')
    } finally {
      setSyncing(false)
    }
  }

  async function changeInterval(minutes: number) {
    setError('')
    const res = await authedFetch('/api/admin/brands/sync', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intervalMinutes: minutes }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error || 'Could not change the interval.')
    else setIntervalMinutes(data.intervalMinutes)
  }

  return (
    <div className="card" style={{ padding: '14px 18px', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Clock size={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 220, fontSize: 14 }}>
          <strong>Sheet sync</strong>{' '}
          <span style={{ color: 'var(--text-2)' }}>
            · last run {lastRunAt ? new Date(lastRunAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'never'}
          </span>
        </div>
        <label htmlFor="sync-interval" style={{ fontSize: 13, color: 'var(--text-2)' }}>Check sheets</label>
        <select
          id="sync-interval"
          className="input"
          style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
          value={interval ?? 60}
          onChange={(e) => changeInterval(Number(e.target.value))}
          disabled={interval === null}
        >
          {INTERVALS.map((i) => (
            <option key={i.minutes} value={i.minutes}>{i.label}</option>
          ))}
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={syncNow} disabled={syncing}>
          <RefreshCw size={13} aria-hidden="true" style={{ marginRight: 6 }} />
          {syncing ? 'Syncing… (drafting can take a minute)' : 'Sync now'}
        </button>
      </div>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
      {result && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-2)' }}>
          {result.length === 0 ? <li>No active brands to sync.</li> : result.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
    </div>
  )
}
