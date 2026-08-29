'use client'

import { useState } from 'react'
import { AlertTriangle, FileSearch, Loader2, Sparkles } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'
import styles from './ContractRedliner.module.css'

const SAMPLE_CLAUSE = `7. INDEMNIFICATION
The Contractor shall indemnify, defend, and hold harmless the Company, its officers, directors, and employees from and against any and all claims, damages, losses, and expenses, including reasonable attorney's fees, arising out of or in any way connected with this Agreement, regardless of cause, including the sole negligence of the Company.

8. TERMINATION
This Agreement shall remain in effect indefinitely and may only be terminated by the Company, at its sole discretion, with no notice required.

9. PAYMENT
Payment terms shall be determined by the Company from time to time and communicated to the Contractor as it sees fit.`

interface Clause {
  text: string
  risk: 'red' | 'yellow'
  reason: string
}

export default function ContractRedliner() {
  const [contractText, setContractText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clauses, setClauses] = useState<Clause[] | null>(null)
  const [summary, setSummary] = useState('')

  async function handleAnalyze() {
    if (!contractText.trim() || loading) return
    setLoading(true)
    setError('')
    trackEvent('redliner_analyze_clicked')
    try {
      const res = await fetch('/api/contract-redline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contractText }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setClauses(null)
        return
      }
      setClauses(data.clauses ?? [])
      setSummary(data.summary ?? '')
      trackEvent('redliner_result_received', { flagged: data.clauses?.length ?? 0 })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function loadSample() {
    setContractText(SAMPLE_CLAUSE)
    setClauses(null)
    setError('')
  }

  const redCount = clauses?.filter((c) => c.risk === 'red').length ?? 0
  const yellowCount = clauses?.filter((c) => c.risk === 'yellow').length ?? 0

  return (
    <div className={styles.wrap}>
      <div className={`card glass-panel ${styles.panel}`} style={{ padding: 24 }}>
        <div className={styles.panelHead}>
          <span className="label-mono" style={{ color: 'var(--accent)' }}>Paste a clause or contract</span>
          <button type="button" className={styles.sampleBtn} onClick={loadSample}>
            Try a sample clause
          </button>
        </div>

        <textarea
          className={styles.textarea}
          placeholder="Paste an NDA, service agreement, or any clause you want a risk read on…"
          value={contractText}
          onChange={(e) => setContractText(e.target.value)}
          maxLength={6000}
          aria-label="Contract text to analyze"
        />

        <div className={styles.actionsRow}>
          <span className={styles.charCount}>{contractText.length.toLocaleString()} / 6,000</span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!contractText.trim() || loading}
            onClick={handleAnalyze}
          >
            {loading ? (
              <>
                <Loader2 size={16} strokeWidth={2} className="spin" aria-hidden="true" /> Analyzing…
              </>
            ) : (
              <>
                <Sparkles size={16} strokeWidth={2} aria-hidden="true" /> Analyze for Risk
              </>
            )}
          </button>
        </div>
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} strokeWidth={1.5} aria-hidden="true" /> {error}
          </p>
        )}
      </div>

      <div className={`card glass-panel ${styles.panel}`} style={{ padding: 24 }}>
        <div className={styles.panelHead}>
          <span className="label-mono" style={{ color: 'var(--accent)' }}>Risk read-out</span>
          {clauses && clauses.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {redCount} high · {yellowCount} worth a look
            </span>
          )}
        </div>

        {!clauses ? (
          <div className={styles.emptyState}>
            <FileSearch size={32} strokeWidth={1.2} aria-hidden="true" />
            <p style={{ maxWidth: 280 }}>
              Paste a contract on the left and click Analyze. Flagged clauses appear here, color-coded by risk.
            </p>
          </div>
        ) : clauses.length === 0 ? (
          <div className={styles.emptyState}>
            <p style={{ maxWidth: 280 }}>{summary || "Nothing flagged — this doesn't look like a contract, or no material risks were found."}</p>
          </div>
        ) : (
          <div className={styles.resultsScroll}>
            {summary && <div className={styles.summary}>{summary}</div>}
            {clauses.map((c, i) => (
              <div key={i} className={`${styles.clauseCard} ${styles[c.risk]}`}>
                <div className={styles.clauseHeader}>
                  <span className={`${styles.riskBadge} ${styles[c.risk]}`}>
                    {c.risk === 'red' ? 'High Risk' : 'Worth a Look'}
                  </span>
                </div>
                <div className={styles.clauseQuote}>&ldquo;{c.text}&rdquo;</div>
                <div className={styles.clauseReason}>{c.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
