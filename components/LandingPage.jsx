'use client'

import Link from 'next/link'
import Reveal from './Reveal'
import ChatPreview from './ChatPreview'
import HeroVideo from './HeroVideo'
import RecoveredCounter from './RecoveredCounter'
import HowItWorks from './HowItWorks'
import Timeline from './Timeline'
import { safeJsonLd } from '@/lib/jsonLd'

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

/* Every answer restates a fact already on this page (fees, signing, the
   14-day clock, the free check). No outcome or speed promises. */
const FAQS = [
  {
    q: 'What does Pandas LP do?',
    a: 'Pandas LP is a licensed Nigerian law firm (CAC BN 9646741) handling debt recovery and property law: letters of demand, follow-ups, filing at the Small Claims Court, notices to quit, tenancy and lease documents, deeds of assignment and property searches.',
  },
  {
    q: 'How much does a letter of demand cost?',
    a: 'A letter of demand is ₦10,000 if you serve it yourself, or ₦25,000 if we serve it for you. The Day 7 and Day 14 follow-ups are included. Court filing fees, if the matter goes further, are set by the court.',
  },
  {
    q: 'Who prepares and signs the documents?',
    a: 'Each document is drafted from the firm’s template, then reviewed and signed by a licensed legal practitioner before it goes anywhere. You read the draft before you pay.',
  },
  {
    q: 'What happens if the debtor still does not pay?',
    a: 'After the letter is served, a follow-up goes out on Day 7 and the response window closes on Day 14. If the debt is still unpaid, the matter can move to filing at the Small Claims Court.',
  },
  {
    q: 'How much do property documents cost?',
    a: 'Each tenancy or lease document is ₦25,000. Deeds transferring title are invoiced by the firm at 2.5% of the consideration.',
  },
  {
    q: 'I am not sure my debt is worth chasing. Where do I start?',
    a: 'Use the free debt check. It is seven quick questions, takes about a minute, and shows how strong your case looks and what it would cost.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
}

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
      {/* ══ HERO ══ full-bleed film with the page's key messages on it.
          Debt recovery is the main action; the free debt check is a
          secondary way in for visitors not ready to start. */}
      <section className="lp-hero-full" aria-label="Pandas LP">
        <HeroVideo />
        <div className="lp-hero-shade" aria-hidden="true" />
        <div className="lp-container lp-hero-inner">
          {/* The kicker sits inside the h1 so the heading carries the brand and the
              practice areas for search. */}
          <h1 className="lp-h1">
            <span className="lp-eyebrow lp-h1-kicker">Pandas LP &nbsp;·&nbsp; Debt recovery and property law in Nigeria</span>
            Tell us what happened.<br />
            <span className="lp-em">We take it from there.</span>
          </h1>

          <p className="lp-lede">
            Recover money you are owed with a letter of demand from ₦10,000, reviewed and
            signed by a licensed practitioner. Day 7 and Day 14 follow-ups are included.
          </p>

          <div className="lp-hero-actions">
            <button type="button" className="lp-cta lp-cta-gold" onClick={() => onOpenAgent(DEBT_AGENT)}>
              Start a debt recovery &rarr;
            </button>
            <button type="button" className="lp-cta lp-cta-ghost" onClick={() => onOpenAgent(PROPERTY_AGENT)}>
              I have a property matter
            </button>
          </div>

          <p className="lp-hero-sub">
            Not sure it is worth chasing?{' '}
            <Link href="/debt-check?ref=home-hero">Take the free 1-minute debt check &rarr;</Link>
            <span className="lp-hero-sep" aria-hidden="true">·</span>
            <button type="button" onClick={onStartLawyerConsult}>Speak to a lawyer first &rarr;</button>
          </p>

          <ul className="lp-hero-proof">
            <li>Signed by a licensed practitioner</li>
            <li>You read the draft before you pay</li>
            <li>No retainer. No hourly rate.</li>
            <li>CAC BN 9646741</li>
          </ul>
        </div>
      </section>

      {/* ══ PRODUCT ══ the real chat, moved down from the hero */}
      <section className="lp-section lp-container" id="start" aria-label="How a matter starts">
        <div className="lp-hero-grid">
          <div>
            <h2 className="lp-h2 lp-section-head">It starts with a few plain questions.</h2>
            <p className="lp-lede">
              Pick your problem and answer in your own words. A licensed practitioner reviews
              everything before any letter is signed or served.
            </p>
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

      {/* ══ FAQ ══ plain <details>, so the answers are in the server HTML */}
      <section className="lp-section lp-muted" id="faq" aria-label="Questions">
        <div className="lp-container">
          <h2 className="lp-h2 lp-section-head">Questions people ask first.</h2>
          <div className="lp-faq">
            {FAQS.map((f) => (
              <details key={f.q} className="lp-faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
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
