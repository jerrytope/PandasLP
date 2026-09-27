'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function UnsubscribeForm() {
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const t = params.get('t') ?? ''
  const who = id.startsWith('e:') ? id.slice(2) : id.startsWith('p:') ? `+${id.slice(2)}` : ''
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function unsubscribe() {
    setState('busy')
    try {
      const res = await fetch('/api/unsubscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, t }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.')
        setState('error')
        return
      }
      setState('done')
    } catch {
      setError('Network error. Please try again.')
      setState('error')
    }
  }

  const h1: React.CSSProperties = { fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.025em', fontWeight: 500, marginBottom: 14 }
  const p: React.CSSProperties = { fontSize: 16.5, color: '#3A3A38', lineHeight: 1.55 }

  if (!who || !t) {
    return (
      <>
        <h1 style={h1}>Unsubscribe</h1>
        <p style={p}>This link is incomplete. To stop hearing from us, email <a href="mailto:pandaslegalpractitioners@gmail.com">pandaslegalpractitioners@gmail.com</a> or reply STOP on WhatsApp.</p>
      </>
    )
  }
  if (state === 'done') {
    return (
      <>
        <h1 style={h1}>You’re unsubscribed</h1>
        <p style={p}>We won’t send tips or news to {who} again. If you have a case with us, we’ll still contact you about it.</p>
      </>
    )
  }
  return (
    <>
      <h1 style={h1}>Stop tips and news from Pandas LP?</h1>
      <p style={p}>We’ll stop sending marketing messages to <strong>{who}</strong>. Messages about a case you have with us are not affected.</p>
      <button
        type="button"
        onClick={unsubscribe}
        disabled={state === 'busy'}
        style={{ marginTop: 22, background: '#1A1A1A', color: '#FAFAF8', border: 'none', padding: '15px 22px', fontSize: 16, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
      >
        {state === 'busy' ? 'Unsubscribing…' : 'Unsubscribe'}
      </button>
      {state === 'error' && <p role="alert" style={{ color: 'var(--danger)', marginTop: 12, fontSize: 14.5 }}>{error}</p>}
    </>
  )
}
