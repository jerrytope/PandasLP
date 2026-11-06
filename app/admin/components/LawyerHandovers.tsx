'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { authedFetch } from '@/lib/supabaseClient'

interface Handover {
  id: string
  created_at: string
  case_id: string | null
  agent_id: string
  kind: 'legal_question' | 'lawyer_review' | 'client_request'
  summary: string
  contact_preference: string | null
  contact_detail: string | null
  client_email: string | null
  client_phone: string | null
}

const kindLabels: Record<Handover['kind'], string> = {
  legal_question: 'Legal question',
  lawyer_review: 'Lawyer review requested',
  client_request: 'Client asked for a lawyer',
}

export default function LawyerHandovers() {
  const [items, setItems] = useState<Handover[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await authedFetch('/api/admin/handovers')
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not load lawyer handovers.')
      setItems(json.items ?? [])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lawyer handovers.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function markDone(id: string) {
    setBusy(id)
    setError('')
    try {
      const response = await authedFetch('/api/admin/handovers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Could not complete handover.')
      setItems((current) => current.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete handover.')
    } finally {
      setBusy('')
    }
  }

  if (error && !items.length) return <p role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>
  if (!items.length) return null

  return (
    <section>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, margin: '0 0 8px', color: 'var(--text-1)' }}>
        <UserRound size={18} aria-hidden="true" /> Lawyer handovers <span className="badge">{items.length}</span>
      </h2>
      {error && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((item) => (
          <article key={item.id} className="card" style={{ padding: 14, display: 'grid', gap: 6 }}>
            <strong>{kindLabels[item.kind]} · {item.agent_id}</strong>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{item.summary}</p>
            <div style={{ color: 'var(--text-2)', fontSize: 12 }}>
              {item.contact_preference ? `Prefers ${item.contact_preference}. ` : ''}
              {item.contact_detail ? `Contact: ${item.contact_detail}. ` : ''}
              {item.client_email ? `Email: ${item.client_email}. ` : ''}
              {item.client_phone ? `Phone: ${item.client_phone}. ` : ''}
              Case: {item.case_id ?? 'not linked to a case'} · {new Date(item.created_at).toLocaleString()}
            </div>
            <div>
              <button type="button" className="btn btn-sm" disabled={busy === item.id} onClick={() => void markDone(item.id)}>
                {busy === item.id ? 'Saving…' : 'Mark handled'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
