'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
  const [closing, setClosing] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  useFocusTrap(modalRef, true)

  // Defers the real unmount (the onClose prop) until AnimatePresence has finished playing
  // the exit transition below — closing this any other way (calling onClose directly) would
  // hard-cut the modal instead of letting it dematerialize.
  function requestClose() {
    setClosing(true)
  }

  // Escape-to-close, and return focus to whatever triggered the modal once it unmounts —
  // standard dialog behavior, otherwise keyboard/screen-reader users lose their place.
  const triggerRef = useRef<Element | null>(null)
  useEffect(() => {
    triggerRef.current = document.activeElement
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
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
    <AnimatePresence onExitComplete={onClose}>
      {!closing && (
        <motion.div
          className={styles.overlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose() }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Sign in"
            ref={modalRef}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          >
            <div className={styles.header}>
              <div>
                <div className={styles.title}>Sign in to Pandas LP</div>
                <div className={styles.sub}>No password needed, we'll email you a secure link.</div>
              </div>
              <button type="button" className={styles.closeBtn} onClick={requestClose} aria-label="Close">
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
                <button type="button" className="btn btn-ghost btn-block" onClick={requestClose} style={{ marginTop: 20 }}>
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
