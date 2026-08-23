'use client'

import { useRef, useState } from 'react'
import { authedFetch } from '@/lib/supabaseClient'
import styles from './TranslationPane.module.css'

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ig', label: 'Igbo' },
  { code: 'ha', label: 'Hausa' },
  { code: 'pcm', label: 'Nigerian Pidgin' },
] as const

interface TranslationPaneProps {
  originalText: string
  /** Parent owns what "replace" actually means (e.g. re-saving to the case) — this component
   *  only hands back the translated text, it never assumes persistence succeeded. */
  onReplace?: (translatedText: string) => void
  /** Hide the replace action entirely — e.g. on an already-reviewed document, where silently
   *  swapping the text would bypass the mandatory lawyer-review gate every other document
   *  edit in this app goes through. */
  allowReplace?: boolean
}

export default function TranslationPane({ originalText, onReplace, allowReplace = true }: TranslationPaneProps) {
  const [open, setOpen] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState<string>('yo')
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null)
  const [translated, setTranslated] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  async function detectLanguage() {
    try {
      const res = await authedFetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: originalText.slice(0, 500), detectOnly: true }),
      })
      const data = await res.json()
      if (res.ok && data.detectedLanguage) setDetectedLanguage(data.detectedLanguage)
    } catch {
      // Detection is a nice-to-have — a failure here shouldn't block translation itself.
    }
  }

  async function runTranslation() {
    setLoading(true)
    setError('')
    try {
      const res = await authedFetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: originalText, targetLanguage }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Translation failed. Please try again.')
        return
      }
      setTranslated(data.translatedText)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function openPane() {
    setOpen(true)
    if (!detectedLanguage) detectLanguage()
  }

  // Proportional sync — maps scroll percentage from one pane to the other rather than raw
  // pixel offset, since translated text is rarely the same length as the original.
  function handleScroll(source: 'left' | 'right') {
    if (syncingRef.current) { syncingRef.current = false; return }
    const from = source === 'left' ? leftRef.current : rightRef.current
    const to = source === 'left' ? rightRef.current : leftRef.current
    if (!from || !to) return
    const ratio = from.scrollTop / (from.scrollHeight - from.clientHeight || 1)
    syncingRef.current = true
    to.scrollTop = ratio * (to.scrollHeight - to.clientHeight)
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sm" onClick={openPane} style={{ marginTop: 10 }}>
        Translate
      </button>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <select className={styles.select} value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} aria-label="Target language">
          {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en').map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={runTranslation} disabled={loading}>
          {loading ? 'Translating…' : 'Translate'}
        </button>
        {detectedLanguage && (
          <span className={styles.detected}>
            Detected: {SUPPORTED_LANGUAGES.find((l) => l.code === detectedLanguage)?.label ?? detectedLanguage}
          </span>
        )}
        {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
      </div>

      <div className={styles.panes}>
        <div className={`${styles.pane} ${styles.paneLeft}`}>
          <div className={styles.paneLabel}>Original</div>
          <div ref={leftRef} className={styles.paneText} onScroll={() => handleScroll('left')}>
            {originalText}
          </div>
        </div>
        <div className={styles.pane}>
          <div className={styles.paneLabel}>{SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.label}</div>
          <div ref={rightRef} className={styles.paneText} onScroll={() => handleScroll('right')}>
            {translated || <span className={styles.paneEmpty}>Click Translate to see this in {SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.label}.</span>}
          </div>
        </div>
      </div>

      {allowReplace && onReplace && (
        <div className={styles.footer}>
          <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>Close</button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!translated} onClick={() => onReplace(translated)}>
            Replace Original with Translation
          </button>
        </div>
      )}
    </div>
  )
}
