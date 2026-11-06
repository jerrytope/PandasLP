'use client'

import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import { TableProperties } from 'lucide-react'

export default function SendToRegisterButton({ caseId }: { caseId: string }) {
  const [state, setState] = useState<'checking' | 'idle' | 'busy' | 'done'>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setState('checking')
    setError('')
    authedFetch(`/api/admin/matter-register?caseId=${encodeURIComponent(caseId)}`)
      .then(async (response) => {
        const result = await response.json().catch(() => ({}))
        if (!active) return
        if (!response.ok || result.error) {
          setError(result.error || 'Could not load register status.')
          setState('idle')
        } else if (result.sync?.status === 'synced') {
          setState('done')
        } else {
          setError(result.sync?.error ?? '')
          setState('idle')
        }
      })
      .catch(() => {
        if (!active) return
        setError('Could not load register status.')
        setState('idle')
      })
    return () => { active = false }
  }, [caseId])

  async function send() {
    setState('busy')
    setError('')
    try {
      const response = await authedFetch('/api/admin/matter-register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.error) {
        setError(result.error || 'Could not reach the register.')
        setState('idle')
        return
      }
      setState('done')
    } catch {
      setError('Network error. Please try again.')
      setState('idle')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14, fontSize: 12.5, color: 'var(--text-2)' }}>
      <button type="button" className="btn btn-sm" onClick={send} disabled={state !== 'idle'}>
        <TableProperties size={13} aria-hidden="true" />
        {state === 'checking' ? 'Checking register…' : state === 'busy' ? 'Sending…' : state === 'done' ? 'On the matter register' : error ? 'Retry register sync' : 'Send to matter register'}
      </button>
      {state === 'idle' && !error && <span>Paid cases sync automatically; use this to retry.</span>}
      {error && <span role="alert" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}
