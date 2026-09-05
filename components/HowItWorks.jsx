'use client'

import { useEffect, useRef, useState } from 'react'

/* ─────────────────────────────────────────────────────────────
   The three steps, told visually.

   This section carries the firm's whole trust proposition, and it
   used to be three paragraphs in three boxes. The words were right;
   nothing showed you what they meant.

   Each step now renders the artifact that actually exists at that
   point in a matter: the client's own sentence, the draft assembling
   itself from the firm's template, and a practitioner's signature
   going onto it. The sequence is the argument. The machine does the
   middle, and the last thing that happens is a person putting their
   name to it, which is why the signature is the final beat and why
   step three is the weighted one.

   Motion is justified as storytelling: the order of events IS the
   product. It runs once, on entry, and never loops, because a law
   firm's homepage should not fidget. Under prefers-reduced-motion
   every stage renders in its finished state with no animation at
   all, which loses the sequencing but keeps every fact on screen.
   ───────────────────────────────────────────────────────────── */

const STEPS = [
  { n: '1', t: 'You describe it', b: 'In your own words, at any hour. No forms, no legal vocabulary.' },
  { n: '2', t: 'We draft it', b: 'From the firm’s own template for that exact document, not from scratch.' },
  { n: '3', t: 'A lawyer signs it', b: 'Nothing reaches a debtor, a tenant or a court unsigned.', on: true },
]

export default function HowItWorks() {
  const ref = useRef(null)
  const [live, setLive] = useState(false)

  // IntersectionObserver rather than a scroll listener: no work on frames where
  // nothing is happening, and it disconnects the moment the section has played.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setLive(true); return }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLive(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`hiw${live ? ' is-live' : ''}`}>
      {STEPS.map((s) => (
        <div key={s.n} className={s.on ? 'hiw-step is-on' : 'hiw-step'}>
          <div className="hiw-stage" aria-hidden="true">
            {s.n === '1' && <StageDescribe />}
            {s.n === '2' && <StageDraft />}
            {s.n === '3' && <StageSign />}
          </div>
          <div className="hiw-body">
            <div className="hiw-n">{s.n}</div>
            <h3>{s.t}</h3>
            <p>{s.b}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* Step 1. The client's own sentence, in the shape it arrives in. Lower case and
   unpunctuated on purpose: this is what people actually type, and the promise
   directly above it is that they do not have to write like a lawyer. */
function StageDescribe() {
  return (
    <div className="hiw-chat">
      <div className="hiw-bubble hiw-bubble-a">Who owes you money, and what was it for?</div>
      <div className="hiw-bubble hiw-bubble-u">
        my tenant hasn’t paid since january and won’t answer my calls
      </div>
      <div className="hiw-typing">
        <span /><span /><span />
      </div>
    </div>
  )
}

/* Step 2. Two beats in one frame, because the brief for this section is really
   two ideas: the sentence is read into a structured matter, and the matter is
   filled into the firm's existing template. The field values land first, then
   the document rules draw in underneath. */
function StageDraft() {
  return (
    <div className="hiw-draft">
      <div className="hiw-fields">
        <span className="hiw-field"><b>Matter</b> Recovery of premises</span>
        <span className="hiw-field"><b>Instrument</b> Notice to Quit</span>
        <span className="hiw-field"><b>Notice</b> 6 months, yearly tenancy</span>
      </div>
      <div className="hiw-paper">
        <span className="hiw-rule hiw-rule-head" />
        <span className="hiw-rule" /><span className="hiw-rule" />
        <span className="hiw-rule hiw-rule-short" />
      </div>
    </div>
  )
}

/* Step 3. The signature is drawn with a stroke-dashoffset sweep so it arrives
   last and arrives by hand. Not decoration: a signature is the literal thing
   this step is about, and it is the one part of the process no software does. */
function StageSign() {
  return (
    <div className="hiw-sign">
      <div className="hiw-paper hiw-paper-lift">
        <span className="hiw-rule" /><span className="hiw-rule hiw-rule-short" />
      </div>
      <svg className="hiw-ink" viewBox="0 0 220 64" fill="none" role="presentation">
        <path
          className="hiw-ink-path"
          d="M8 44c18-4 22-30 30-30s6 34 16 34 14-30 24-30 8 26 18 26 16-20 26-20 10 14 20 14 22-8 32-16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <div className="hiw-seal">
        <span className="hiw-seal-line" />
        <span className="hiw-seal-text">Signed by a licensed practitioner</span>
      </div>
    </div>
  )
}
