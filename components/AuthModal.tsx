'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useFocusTrap } from '@/lib/useFocusTrap'
import { X, Mail } from 'lucide-react'
import styles from './AuthModal.module.css'

interface AuthModalProps {
  onClose: () => void
}

const GENERIC_ERROR = "Something went wrong sending your sign-in link. Please try again in a moment."

export default function AuthModal({ onClose }: AuthModalProps) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  // Escape-to-close, and return focus to whatever triggered the modal once it unmounts —
  // standard dialog behavior, otherwise keyboard/screen-reader users lose their place.
  const triggerRef = useRef<Element | null>(null)
  useEffect(() => {
    triggerRef.current = document.activeElement
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError('')

    // Without this try/catch, any thrown error (a network failure, a misconfigured
    // Supabase client, a CORS block) skipped both branches below and left the button
    // stuck on its loading spinner forever with no feedback — see the "button does
    // nothing" report that led here. finally guarantees loading always clears.
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })

      if (authError) {
        // authError.message is sometimes empty or a bare "{}" (Supabase wrapping a raw,
        // non-JSON, or CORS-blocked response) — never show that literally, fall back to
        // something a user can actually act on.
        setError(authError.message && authError.message.trim() !== '{}' ? authError.message : GENERIC_ERROR)
      } else {
        setSent(true)
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC_ERROR)
    } finally {
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
            <div className={styles.sub}>No password needed, we'll email you a secure link.</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        {sent ? (
          <div className={styles.body}>
            <div className={styles.sentBox}>
              <div className={styles.sentIcon}>
                <Mail size={40} strokeWidth={1.5} aria-hidden="true" />
              </div>
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
            {error && <p role="alert" className="error-text" style={{ marginTop: -8, marginBottom: 12 }}>{error}</p>}
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
