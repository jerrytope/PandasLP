'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import s from './DebtCheck.module.css'
import { captureAttribution, getAttribution, setAttributionIfEmpty } from '@/lib/attribution'
import { trackEvent } from '@/lib/analytics'
import {
  ADMISSIONS,
  DEBTOR_TYPES,
  DEBT_AGES,
  LABELS,
  LOCATIONS,
  PROOF_TYPES,
  STATES,
  agentOpener,
  assessDebt,
  normaliseNgPhone,
  type DebtCheckAnswers,
  type ProofType,
} from '@/lib/debtCheck'

const WHATSAPP_NUMBER = '2348118080189'
const SITE = 'https://pandaslp.com.ng'

type Draft = Partial<Omit<DebtCheckAnswers, 'proof'>> & { proof: ProofType[]; amountText: string }
type StepKey = 'debtor' | 'amount' | 'state' | 'age' | 'proof' | 'admission' | 'location'
const STEPS: StepKey[] = ['debtor', 'amount', 'state', 'age', 'proof', 'admission', 'location']

const QUESTIONS: Record<StepKey, { q: string; hint?: string }> = {
  debtor: { q: 'Who owes you the money?' },
  amount: { q: 'How much are you owed?', hint: 'Roughly is fine.' },
  state: { q: 'Where are they?', hint: 'The state where they live or do business.' },
  age: { q: 'When should they have paid?' },
  proof: { q: 'What proof do you have?', hint: 'Choose all that apply.' },
  admission: { q: 'Have they admitted they owe you?' },
  location: { q: 'Can you reach them?' },
}

function parseAmount(text: string): number | null {
  const n = Number(text.replace(/[,\s₦]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function formatAmountInput(text: string): string {
  const digits = text.replace(/[^\d]/g, '').replace(/^0+/, '')
  return digits ? Number(digits).toLocaleString('en-NG') : ''
}

export default function DebtCheck() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>({ proof: [], amountText: '' })
  const [done, setDone] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    captureAttribution()
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
  }, [])

  // Move focus to the new question so keyboard and screen-reader users follow along.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus({ preventScroll: true })
    if (done) window.scrollTo({ top: 0 })
    else headingRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [step, done])

  const key = STEPS[step]
  const amount = parseAmount(draft.amountText)

  function answered(k: StepKey): boolean {
    if (k === 'amount') return amount != null
    if (k === 'proof') return draft.proof.length > 0
    return draft[k] != null
  }

  function next() {
    if (!answered(key)) return
    if (step < STEPS.length - 1) setStep(step + 1)
    else setDone(true)
  }

  function choose<K extends 'debtor' | 'state' | 'age' | 'admission' | 'location'>(k: K, v: DebtCheckAnswers[K]) {
    setDraft((d) => ({ ...d, [k]: v }))
    if (!startedRef.current) {
      startedRef.current = true
      trackEvent('debt_check_start')
    }
    // Single-choice questions move on by themselves after a beat, so the choice is seen.
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      if (step < STEPS.length - 1) setStep(step + 1)
      else setDone(true)
    }, 220)
  }

  function toggleProof(p: ProofType) {
    setDraft((d) => {
      if (p === 'none') return { ...d, proof: d.proof.includes('none') ? [] : ['none'] }
      const without = d.proof.filter((x) => x !== 'none')
      return { ...d, proof: without.includes(p) ? without.filter((x) => x !== p) : [...without, p] }
    })
  }

  if (done) {
    const answers: DebtCheckAnswers = {
      debtor: draft.debtor!,
      amountNaira: amount!,
      age: draft.age!,
      proof: draft.proof,
      admission: draft.admission!,
      location: draft.location!,
      state: draft.state!,
    }
    return (
      <Result
        answers={answers}
        headingRef={headingRef}
        onRestart={() => {
          setDraft({ proof: [], amountText: '' })
          setStep(0)
          setDone(false)
        }}
      />
    )
  }

  const { q, hint } = QUESTIONS[key]
  return (
    <>
      <Intro />
      <section className={s.panel} aria-label="Debt check">
        <div className={s.progress} aria-hidden="true">
          <div className={s.progressFill} style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
        <div className={s.panelBody}>
          <div className={s.stepMeta}>
            <span className={s.eyebrow}>Question {step + 1} of {STEPS.length}</span>
          </div>
          <h2 className={s.q} ref={headingRef} tabIndex={-1} style={{ outline: 'none' }} id="dc-q">{q}</h2>
          {hint && <p className={s.hint}>{hint}</p>}
          {!hint && <div style={{ height: 12 }} />}

          {key === 'debtor' && <Choices name="debtor" values={DEBTOR_TYPES} labels={LABELS.debtor} value={draft.debtor} onChoose={(v) => choose('debtor', v)} />}
          {key === 'state' && <Choices name="state" values={STATES} labels={LABELS.state} value={draft.state} onChoose={(v) => choose('state', v)} />}
          {key === 'age' && <Choices name="age" values={DEBT_AGES} labels={LABELS.age} value={draft.age} onChoose={(v) => choose('age', v)} />}
          {key === 'admission' && <Choices name="admission" values={ADMISSIONS} labels={LABELS.admission} value={draft.admission} onChoose={(v) => choose('admission', v)} />}
          {key === 'location' && <Choices name="location" values={LOCATIONS} labels={LABELS.location} value={draft.location} onChoose={(v) => choose('location', v)} />}

          {key === 'amount' && (
            <form onSubmit={(e) => { e.preventDefault(); next() }}>
              <label className={s.amountRow}>
                <span className={s.naira} aria-hidden="true">₦</span>
                <input
                  className={s.amountInput}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-labelledby="dc-q"
                  placeholder="250,000"
                  value={draft.amountText}
                  onChange={(e) => setDraft((d) => ({ ...d, amountText: formatAmountInput(e.target.value) }))}
                />
              </label>
            </form>
          )}

          {key === 'proof' && (
            <div className={s.options} role="group" aria-labelledby="dc-q">
              {PROOF_TYPES.map((p) => {
                const on = draft.proof.includes(p)
                return (
                  <button key={p} type="button" role="checkbox" aria-checked={on} className={`${s.option} ${on ? s.optionOn : ''}`} onClick={() => toggleProof(p)}>
                    <span className={s.mark} aria-hidden="true">{on ? '✓' : ''}</span>
                    {LABELS.proof[p]}
                  </button>
                )
              })}
            </div>
          )}

          <div className={s.nav}>
            <button type="button" className={s.back} disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
            {(key === 'amount' || key === 'proof' || answered(key)) && (
              <button type="button" className={s.primary} disabled={!answered(key)} onClick={next}>
                {step === STEPS.length - 1 ? 'See my result' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </section>
      <p className={s.fine}>
        Free, and nothing is saved unless you ask a lawyer to contact you. General information, not legal advice.
      </p>
    </>
  )
}

function Intro() {
  return (
    <header>
      <div className={s.eyebrow}>Free debt check · 1 minute</div>
      <h1 className={s.h1}>Can you get your money back?</h1>
      <p className={s.lede}>
        Answer seven quick questions and see how strong your case is, what to do next and what it costs. From Pandas LP, a licensed Lagos law firm.
      </p>
    </header>
  )
}

function Choices<T extends string>({ name, values, labels, value, onChoose }: { name: string; values: readonly T[]; labels: Record<T, string>; value: T | undefined; onChoose: (v: T) => void }) {
  return (
    <div className={s.options} role="radiogroup" aria-labelledby="dc-q">
      {values.map((v) => {
        const on = value === v
        return (
          <button key={v} type="button" role="radio" aria-checked={on} name={name} className={`${s.option} ${on ? s.optionOn : ''}`} onClick={() => onChoose(v)}>
            <span className={`${s.mark} ${s.markRound}`} aria-hidden="true">{on ? '●' : ''}</span>
            {labels[v]}
          </button>
        )
      })}
    </div>
  )
}

const VERDICT_TAG = { strong: 'Strong case', good: 'Good case', possible: 'Possible', difficult: 'Difficult', review: 'Lawyer review' } as const
const VERDICT_CLASS = { strong: s.vStrong, good: s.vGood, possible: s.vPossible, difficult: s.vDifficult, review: s.vReview } as const

function Result({ answers, headingRef, onRestart }: { answers: DebtCheckAnswers; headingRef: React.RefObject<HTMLHeadingElement | null>; onRestart: () => void }) {
  const r = assessDebt(answers)
  const lawyerFirst = r.nextStep === 'lawyer_review'
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    trackEvent('debt_check_result', { verdict: r.verdict, next_step: r.nextStep })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startDebt = () => {
    trackEvent('debt_check_start_letter', { verdict: r.verdict })
    setAttributionIfEmpty('debt-check')
    window.location.href = `/agent/small-claims?auto=${encodeURIComponent(agentOpener(answers))}`
  }
  const startProperty = () => {
    trackEvent('debt_check_start_property', { verdict: r.verdict })
    setAttributionIfEmpty('debt-check')
    window.location.href = '/agent/recovery-of-premises'
  }
  const shareUrl = `${SITE}/debt-check?ref=share`
  const shareText = `Owed money? This free check tells you in a minute whether you can get it back: ${shareUrl}`

  return (
    <>
      <section className={s.panel} aria-label="Your result" style={{ marginTop: 0 }}>
        <div className={s.progress} aria-hidden="true"><div className={s.progressFill} style={{ width: '100%' }} /></div>
        <div className={s.panelBody}>
          <span className={`${s.verdict} ${VERDICT_CLASS[r.verdict]}`}>{VERDICT_TAG[r.verdict]}</span>
          <h1 className={s.resultHead} ref={headingRef} tabIndex={-1} style={{ outline: 'none' }}>{r.headline}</h1>

          <ul className={s.points}>
            {r.points.map((p) => (
              <li key={p.text} className={s.point}>
                <span className={`${s.pointIcon} ${p.tone === 'good' ? s.pointGood : s.pointCaution}`} aria-hidden="true">{p.tone === 'good' ? '✓' : '!'}</span>
                <span><span className="sr-only">{p.tone === 'good' ? 'In your favour: ' : 'Watch out: '}</span>{p.text}</span>
              </li>
            ))}
          </ul>

          <div className={s.next}>
            <p className={s.nextText}>{r.nextStepText}</p>
            {!lawyerFirst && (
              <div className={s.ctaRow}>
                <button type="button" className={s.primary} onClick={startDebt}>Start my letter of demand</button>
                {r.nextStep === 'property' && <button type="button" className={s.secondary} onClick={startProperty}>Get the tenant out</button>}
              </div>
            )}
          </div>

          <Callback answers={answers} primary={lawyerFirst} />

          <div className={s.share}>
            <button type="button" className={s.linkBtn} onClick={onRestart}>Start again</button>
            <a className={s.linkBtn} href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
            <button
              type="button"
              className={s.linkBtn}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl)
                  setCopied(true)
                } catch {
                  /* clipboard blocked; the WhatsApp link still works */
                }
              }}
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </section>
      <div className={s.trust} aria-label="About the firm">
        <span>Licensed Lagos law firm</span><span>CAC BN 9646741</span><span>Signed by a practitioner</span>
      </div>
      <p className={s.fine}>
        This check gives general information based on your answers. It is not legal advice, and no lawyer–client relationship exists until you instruct us. See our <Link href="/privacy">privacy policy</Link>.
      </p>
    </>
  )
}

function Callback({ answers, primary }: { answers: DebtCheckAnswers; primary: boolean }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', note: '', website: '' })
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)
  const [open, setOpen] = useState(primary)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) return setErr('Please add your name.')
    if (!normaliseNgPhone(form.phone)) return setErr('Please add a Nigerian phone number, like 0803 123 4567.')
    if (!consent) return setErr('Please tick the box so we can contact you.')
    setBusy(true)
    try {
      const { source, sourceDetail } = getAttribution()
      const res = await fetch('/api/debt-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answers, ...form, consent, source: source ?? 'debt-check', sourceDetail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) return setErr(data.error || 'Something went wrong. Please try again.')
      trackEvent('debt_check_callback', { primary })
      setSent(true)
    } catch {
      setErr('Network error. Please try again, or message us on WhatsApp.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className={s.callback} role="status">
        <div className={s.done}>
          <span className={s.doneTitle}>Thank you, {form.name.trim().split(' ')[0]}. A lawyer will contact you.</span>
          <span style={{ color: 'var(--text-2)', fontSize: 15 }}>
            We usually reply the same working day. If it’s urgent, <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">message us on WhatsApp</a>.
          </span>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <div className={s.share} style={{ marginTop: 20 }}>
        Not ready to start? <button type="button" className={s.linkBtn} onClick={() => setOpen(true)}>Have a lawyer call me first, free</button>
      </div>
    )
  }

  return (
    <form className={s.callback} onSubmit={submit} noValidate>
      <div className={s.callbackTitle}>{primary ? 'Talk to a lawyer, free' : 'Have a lawyer call me first, free'}</div>
      <p style={{ fontSize: 14.5, color: 'var(--text-2)' }}>A lawyer will look at your answers and contact you, usually the same working day. No obligation.</p>
      <div className={s.fields}>
        <label className={s.field}>Your name<input className={s.input} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className={s.field}>Phone / WhatsApp<input className={s.input} type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className={`${s.field} ${s.fieldFull}`}>Email (optional)<input className={s.input} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className={`${s.field} ${s.fieldFull}`}>Anything else we should know? (optional)<textarea className={s.input} rows={3} maxLength={2000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ resize: 'vertical' }} /></label>
      </div>
      <label className={s.honeypot} aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
      <label className={s.consent}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Pandas LP may contact me by phone, WhatsApp or email about this debt. My answers are kept private and used only for this.</span>
      </label>
      {err && <p className={s.error} role="alert">{err}</p>}
      <button type="submit" className={primary ? s.primary : s.secondary} disabled={busy}>{busy ? 'Sending…' : 'Ask a lawyer to contact me'}</button>
    </form>
  )
}
