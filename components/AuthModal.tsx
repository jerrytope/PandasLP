'use client'

import { useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useFocusTrap } from '@/lib/useFocusTrap'
import styles from './AuthModal.module.css'

interface AuthModalProps {
  onClose: () => void
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Sign in" ref={modalRef}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Sign in to Pandas LP</div>
            <div className={styles.sub}>No password needed — we'll email you a secure link.</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {sent ? (
          <div className={styles.body}>
            <div className={styles.sentBox}>
              <div className={styles.sentIcon}>✉</div>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>Check your email</h3>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                We sent a sign-in link to{' '}
                <strong style={{ color: 'var(--text)' }}>{email}</strong>.
                Click it to access your dashboard and all past cases.
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-block" onClick={onClose} style={{ marginTop: 20 }}>
              Close
            </button>
          </div>
        ) : (
          <form className={styles.body} onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>
            {error && <p className="error-text" style={{ marginTop: -8, marginBottom: 12 }}>{error}</p>}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading || !email.trim()}
            >
              {loading ? <span className="spinner" /> : 'Send Magic Link →'}
            </button>
            <p className={styles.footNote}>New users are automatically registered on first sign-in.</p>
          </form>
        )}
      </div>
    </div>
  )
}
