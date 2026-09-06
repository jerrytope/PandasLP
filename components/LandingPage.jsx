'use client'

import Reveal from './Reveal'
import ChatPreview from './ChatPreview'
import RecoveredCounter from './RecoveredCounter'
import HowItWorks from './HowItWorks'
import Timeline from './Timeline'

/* ─────────────────────────────────────────────────────────────
   Homepage.

   Product first. The previous version explained the firm across four
   argument sections (traditional-vs-chatbot, a systems diagram, the
   agent's constraints, the firm's credentials) and never once showed
   the thing you actually use. The interface is now the hero visual,
   and everything that was an argument is either a short card or gone.

   Facts come from lib/agents.ts and lib/agentCapabilities.ts. No
   testimonials, no client logos, no case counts, and no accuracy
   figures, because none have been measured.

   Styles live under .lp- in app/globals.css.
   ───────────────────────────────────────────────────────────── */

const PROPERTY_AGENT = 'recovery-of-premises'
const DEBT_AGENT = 'small-claims'

const AGENTS_LIVE = [
  {
    id: DEBT_AGENT,
    name: 'Debt Recovery',
    price: 'From ₦10,000',
    img: '/img/img-debt.jpg',
    alt: 'A sealed letter on firm stationery, ready to be served',
    line: 'Demand letter, follow-ups, then filing at the Small Claims Court.',
    outputs: ['LETTER OF DEMAND', 'DAY 7 / 14 FOLLOW-UP', 'COURT FILING', 'REPRESENTATION'],
    cta: 'Start a recovery matter',
  },
  {
    id: PROPERTY_AGENT,
    name: 'Property Law',
    price: 'From ₦25,000',
    img: '/img/img-property.jpg',
    alt: 'A folded land survey plan, a rolled deed and two keys',
    line: 'Tenancy documents at ₦25,000. Transfer deeds at 2.5% of the consideration.',
    outputs: ['NOTICE TO QUIT', 'TENANCY / LEASE', 'DEED OF ASSIGNMENT', 'PROPERTY SEARCH'],
    cta: 'Start a property matter',
  },
]

const CLOCK = [
  { d: '00', t: 'Served' },
  { d: '07', t: 'Follow-up sent' },
  { d: '14', t: 'Window closes' },
  { d: '15', t: 'We file', on: true },
]

/* The cheapest thing anyone can actually buy, pulled out of the list and given
   the weight. It used to be the third row of six, which meant the single most
   persuasive number on the page was the one nobody could find. */
const FEE_LEAD = {
  value: '₦10,000',
  label: 'Letter of demand, yours to serve',
  note: 'Drafted from the firm’s template, reviewed and signed by a licensed practitioner before it goes anywhere.',
}

const FEES = [
  { label: 'The same letter, served by us', value: '₦25,000' },
  { label: 'Day 7 and Day 14 follow-ups', value: 'Included', accent: true },
  { label: 'Each tenancy or lease document', value: '₦25,000' },
  { label: 'Deeds transferring title, invoiced by the firm', value: '2.5% of the consideration' },
  { label: 'Court filing fees', value: 'Set by the court', muted: true },
]

export default function LandingPage({ onOpenAgent, onStartLawyerConsult }) {
  return (
    <>
      {/* ══ HERO + PRODUCT ══ */}
      <section className="lp-hero lp-container" aria-label="Pandas LP">
        <div className="lp-hero-grid">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">Debt recovery and property law &nbsp;·&nbsp; Lagos</div>

            <h1 className="lp-h1">
              Tell us what happened.<br />
              <span className="lp-em">We take it from there.</span>
            </h1>

            <p className="lp-lede">
              Court-ready documents from ₦10,000. Ten minutes of your time, then a licensed
              practitioner finishes the work and signs it.
            </p>

            <button type="button" className="lp-textlink" onClick={onStartLawyerConsult}>
              Or speak to a lawyer first &rarr;
            </button>
          </div>

          <ChatPreview onOpenAgent={onOpenAgent} />
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="lp-section lp-muted" id="how-it-works" aria-label="How it works">
        <div className="lp-container">
          <h2 className="lp-h2 lp-section-head">Three steps, and one of them is a person.</h2>

          <HowItWorks />

          <div className="lp-trust">
            <span>Signed by a licensed practitioner</span>
            <span>You read the draft before you pay</span>
            <span>No accuracy claims. None have been measured.</span>
            <span>CAC BN 9646741</span>
          </div>
        </div>
      </section>

      {/* ══ AGENTS ══ */}
      <section className="lp-section lp-container" id="services" aria-label="What we take">
        <h2 className="lp-h2 lp-section-head">Two matters we take today.</h2>

        <div className="lp-agents">
          {AGENTS_LIVE.map((a, i) => (
            <Reveal key={a.id} delay={i * 80}>
              <div className="lp-agent">
                <div className="lp-agent-img">
                  <img src={a.img} alt={a.alt} loading="lazy" />
                </div>
                <div className="lp-agent-head">
                  <h3>{a.name}</h3>
                  <span className="lp-eyebrow">{a.price}</span>
                </div>
                <div className="lp-agent-body">
                  <p>{a.line}</p>
                  <div className="lp-chips">
                    {a.outputs.map((o) => <span key={o} className="lp-chip">{o}</span>)}
                  </div>
                </div>
                <div className="lp-agent-foot">
                  <button type="button" className="btn btn-primary btn-block" onClick={() => onOpenAgent(a.id)}>
                    {a.cta}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ THE CLOCK ══ */}
      <section className="lp-section lp-muted" aria-label="After the letter goes out">
        <div className="lp-container">
          <h2 className="lp-h2 lp-section-head">After it goes out, the chasing is ours.</h2>
          <Timeline cells={CLOCK} />
        </div>
      </section>

      {/* ══ RECOVERED ══ renders nothing until there is a real confirmed total */}
      <RecoveredCounter />

      {/* ══ FEES ══ */}
      <section className="lp-section lp-container" id="pricing" aria-label="Fees">
        <h2 className="lp-h2 lp-section-head">No retainer. No hourly rate.</h2>

        <div className="lp-fee-lead">
          <div className="lp-fee-figure">
            <span className="lp-fee-from">Where it starts</span>
            <span className="lp-fee-amount">{FEE_LEAD.value}</span>
            <span className="lp-fee-what">{FEE_LEAD.label}</span>
          </div>
          <p className="lp-fee-note">{FEE_LEAD.note}</p>
        </div>

        <div className="lp-fees">
          {FEES.map((f, i) => (
            <div key={f.label} className={`lp-row${i === 0 ? ' lp-row-first' : ''}`}>
              <span style={{ color: f.muted ? 'var(--text-2)' : 'var(--text-1)' }}>{f.label}</span>
              <span className="lp-row-val" style={{ color: f.accent ? 'var(--accent)' : f.muted ? 'var(--text-2)' : 'var(--text-1)' }}>
                {f.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="lp-section lp-dark" aria-label="Start a matter">
        <div className="lp-container lp-cta-band">
          <h2 className="lp-h2">Start with the problem,<br />not the paperwork.</h2>
          <div className="lp-cta-row">
            <button type="button" className="lp-cta lp-cta-invert" onClick={() => onOpenAgent(DEBT_AGENT)}>
              Someone owes me money
            </button>
            <button type="button" className="lp-cta lp-cta-ghost" onClick={() => onOpenAgent(PROPERTY_AGENT)}>
              I have a property matter
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
