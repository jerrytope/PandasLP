'use client'

import { useState } from 'react'
import Reveal from './Reveal'

/* ─────────────────────────────────────────────────────────────
   Homepage.

   Written to be scanned, not read. Each section is a claim plus the
   evidence for it, and the evidence is a picture, a table or a list
   wherever it can be. Prose is the fallback, not the default.

   The hero never names the technology. It leads with the offer, and the
   model is explained further down, once there is a reason to care.

   Everything factual is drawn from lib/agents.ts and
   lib/agentCapabilities.ts. Nothing is invented: no testimonials, no
   client logos, no case counts, and deliberately no accuracy figures,
   because none have ever been measured.

   Styles live under .lp- in app/globals.css.
   ───────────────────────────────────────────────────────────── */

const PROPERTY_AGENT = 'recovery-of-premises'
const DEBT_AGENT = 'small-claims'

const AGENTS_LIVE = [
  {
    id: PROPERTY_AGENT,
    name: 'Property Law',
    price: 'From ₦5,000',
    img: '/img/img-property.jpg',
    alt: 'A folded land survey plan, a rolled deed and two keys',
    openers: [
      '“My tenant hasn’t paid since January and I want him out.”',
      '“I’m buying land in Ikorodu. Can you check the title first?”',
    ],
    outputs: ['NOTICE TO QUIT', 'SEVEN DAYS’ NOTICE', 'TENANCY / LEASE', 'DEED OF ASSIGNMENT', 'DEED OF GIFT', 'DEED OF MORTGAGE', 'POWER OF ATTORNEY', 'SALE OF LAND', 'TITLE SEARCH'],
    lawyer: 'Each document is checked against its own reviewer checklist before it can be signed.',
    cta: 'Start a property matter',
  },
  {
    id: DEBT_AGENT,
    name: 'Debt Recovery',
    price: 'From ₦10,000',
    img: '/img/img-debt.jpg',
    alt: 'A sealed letter on firm stationery, ready to be served',
    openers: [
      '“My business partner took the client payment and never paid my share.”',
      '“I delivered the job in March and the invoice is still unpaid.”',
    ],
    outputs: ['LETTER OF DEMAND', 'EVIDENCE REVIEW', 'DAY 7 / DAY 14 FOLLOW-UP', 'SMALL CLAIMS FILING', 'COURT REPRESENTATION'],
    lawyer: 'A practitioner signs the letter before it is served, and takes over if liability is disputed.',
    cta: 'Start a recovery matter',
  },
]

const NOTICE_LADDER = [
  { type: 'Weekly', period: '1 week' },
  { type: 'Monthly', period: '1 month' },
  { type: 'Quarterly', period: '3 months' },
  { type: 'Yearly', period: '6 months', highlight: true },
]

const FENCES = [
  { n: '01', title: 'It fills templates, it does not compose documents.', body: 'Every draft starts from the firm’s vetted template for that exact instrument.' },
  { n: '02', title: 'It establishes the state before it advises.', body: 'Property law is state law. Lagos, Ogun and the FCT give different answers.' },
  { n: '03', title: 'It knows the periods that void a document.', body: 'A one-month notice on a yearly tenancy is void. The ladder is fixed, not inferred.' },
  { n: '04', title: 'It says when it does not know.', body: 'No C of O number, plot number or statute section you have not given it.' },
]

const FIRM = [
  { title: 'Review is a checklist', body: 'Governor’s Consent clause present, execution block correct, figures reconciled.' },
  { title: 'Some matters never reach it', body: 'Disputed ownership, squatters, live litigation or fraud go straight to a practitioner.' },
  { title: 'No accuracy badge', body: 'We have not measured one, so we do not claim one. A lawyer reads everything.' },
]

const FEES = [
  { label: 'Any property document', value: '₦5,000' },
  { label: 'Letter of demand, yours to serve', value: '₦10,000' },
  { label: 'The same letter, served by Pandas LP', value: '₦25,000' },
  { label: 'Day 7 and Day 14 follow-ups', value: 'Included', accent: true },
  { label: 'Court filing fees', value: 'Set by the court', muted: true },
]

export default function LandingPage({ onOpenAgent, onStartLawyerConsult, onStartCustomClaim, user, onRequestAuth }) {
  const [referralCopied, setReferralCopied] = useState(false)

  const referralCode = user?.id ? user.id.slice(0, 8) : null
  const referralLink = referralCode && typeof window !== 'undefined'
    ? `${window.location.origin}/?ref=${referralCode}`
    : ''

  function copyReferralLink() {
    if (!referralLink) return
    navigator.clipboard?.writeText(referralLink).then(() => {
      setReferralCopied(true)
      setTimeout(() => setReferralCopied(false), 2000)
    })
  }

  return (
    <>
      {/* ══ HERO ══ */}
      <section className="lp-hero lp-container" aria-label="Pandas LP">
        <div className="lp-eyebrow">Debt recovery and property law &nbsp;·&nbsp; Lagos, Nigeria</div>

        <h1 className="lp-h1">
          Tell us what happened.<br />
          <span style={{ fontStyle: 'italic', fontWeight: 400 }}>We take it from there.</span>
        </h1>

        <div className="lp-hero-grid">
          <p className="lp-lede">
            Court-ready documents from ₦5,000. Ten minutes of your time, then a licensed
            practitioner finishes the work and signs it.
          </p>

          <div className="lp-cta-stack">
            <button type="button" className="lp-cta lp-cta-dark" onClick={() => onOpenAgent(PROPERTY_AGENT)}>
              <div className="lp-cta-title">I have a property matter</div>
              <div className="lp-cta-sub">Tenancy, lease, deed, transfer or title</div>
            </button>
            <button type="button" className="lp-cta lp-cta-line" onClick={() => onOpenAgent(DEBT_AGENT)}>
              <div className="lp-cta-title">Someone owes me money</div>
              <div className="lp-cta-sub">Demand letter through to court</div>
            </button>
            <button type="button" className="lp-textlink" onClick={onStartLawyerConsult}>
              Not sure which? Speak to a lawyer first &rarr;
            </button>
          </div>
        </div>

        <div className="lp-credentials">
          <span>From ₦5,000</span>
          <span>No retainer, no hourly billing</span>
          <span>Signed by a licensed practitioner</span>
          <span>You read the draft before you pay</span>
          <span>CAC BN 9646741</span>
        </div>
      </section>

      {/* ══ BAND ══ */}
      <div className="lp-band">
        <img className="lp-drift" src="/img/img-hero.jpg" alt="A signed letter on firm letterhead, a fountain pen and a brass seal" loading="lazy" />
      </div>

      {/* ══ THE THREE OPTIONS ══ */}
      <section className="lp-section lp-muted" aria-label="Why Pandas LP exists">
        <div className="lp-container">
          <h2 className="lp-h2 lp-section-head">
            Legal help here is either hard to reach<br />or nobody&rsquo;s responsibility.
          </h2>

          <div className="lp-tri">
            <div>
              <div className="lp-eyebrow lp-col-label">A traditional firm</div>
              <h3>Accountable, and hard to reach.</h3>
              <p>A retainer conversation, office hours, and a bill you cannot forecast.</p>
            </div>
            <div>
              <div className="lp-eyebrow lp-col-label">A general chatbot</div>
              <h3>Instant, and unaccountable.</h3>
              <p>It cannot serve a notice, file at a court, or answer for being wrong.</p>
            </div>
            <div>
              <div className="lp-eyebrow lp-col-label">Pandas LP</div>
              <h3>Both, without the trade.</h3>
              <p>Bring the matter at any hour. A practitioner signs the result.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ THE MODEL ══ */}
      <section className="lp-section lp-dark" id="how-it-works" aria-label="How the work moves">
        <div className="lp-container">
          <div className="lp-section-head">
            <div className="lp-eyebrow lp-eyebrow-accent">How the work moves</div>
            <h2 className="lp-h2" style={{ color: 'var(--bg-0)' }}>Every route ends at a practitioner.</h2>
            <p className="lp-lede">
              Software runs the interview and the first draft, then stops at a hard line. The two
              side paths below are the ones most firms never show you.
            </p>
          </div>

          <figure style={{ margin: 0 }}>
            <svg
              className="lp-diagram"
              viewBox="0 0 1264 470"
              role="img"
              aria-label="A matter moves from the client through the interview and drafting to a licensed practitioner, who is the only route to the outside world. Escalation sends some matters straight to a practitioner, and a reviewed draft can be returned for correction."
            >
              <defs>
                <marker id="lpArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="#FAFAF8" />
                </marker>
                <marker id="lpArrowGold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="#D4A84B" />
                </marker>
              </defs>

              <line x1="742" y1="34" x2="742" y2="446" stroke="#D4A84B" strokeWidth="1.5" strokeDasharray="7 6" />
              <text x="742" y="20" textAnchor="middle" fill="#D4A84B" fontSize="11.5" letterSpacing="1.6">
                NOTHING CROSSES THIS LINE UNSIGNED
              </text>

              <g className="lp-doc">
                <animateMotion
                  dur="11s"
                  repeatCount="indefinite"
                  calcMode="linear"
                  path="M90,190 L1166,190"
                  keyPoints="0;0.236;0.236;0.472;0.472;0.749;0.749;1;1"
                  keyTimes="0;0.12;0.22;0.34;0.46;0.60;0.78;0.90;1"
                />
                <rect x="-8" y="-10" width="16" height="20" rx="1" fill="#FAFAF8" stroke="#141414" strokeWidth="0.8">
                  <animate attributeName="fill" values="#FAFAF8;#FAFAF8;#D4A84B;#D4A84B" keyTimes="0;0.525;0.545;1" dur="11s" repeatCount="indefinite" />
                </rect>
                <line x1="-4.5" y1="-5" x2="4.5" y2="-5" stroke="#141414" strokeWidth="0.9" />
                <line x1="-4.5" y1="-1" x2="4.5" y2="-1" stroke="#141414" strokeWidth="0.9" />
                <line x1="-4.5" y1="3" x2="1.5" y2="3" stroke="#141414" strokeWidth="0.9" />
              </g>

              <rect x="2" y="150" width="176" height="80" fill="#141414" stroke="#FAFAF8" strokeWidth="1.2" />
              <text x="90" y="182" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">You describe</text>
              <text x="90" y="201" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">the matter</text>

              <rect x="256" y="150" width="176" height="80" fill="#141414" stroke="#FAFAF8" strokeWidth="1.2" />
              <text x="344" y="182" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">A guided</text>
              <text x="344" y="201" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">interview</text>

              <rect x="510" y="150" width="176" height="80" fill="#141414" stroke="#FAFAF8" strokeWidth="1.2" />
              <text x="598" y="182" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">Drafted from the</text>
              <text x="598" y="201" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">firm&rsquo;s template</text>

              <rect x="800" y="144" width="192" height="92" fill="#D4A84B" />
              <text x="896" y="178" textAnchor="middle" fill="#141414" fontSize="13.5" fontWeight="700">A licensed</text>
              <text x="896" y="197" textAnchor="middle" fill="#141414" fontSize="13.5" fontWeight="700">practitioner reviews,</text>
              <text x="896" y="216" textAnchor="middle" fill="#141414" fontSize="13.5" fontWeight="700">corrects and signs</text>

              <rect x="1070" y="150" width="192" height="80" fill="#141414" stroke="#FAFAF8" strokeWidth="1.2" />
              <text x="1166" y="175" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">Served, filed,</text>
              <text x="1166" y="194" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">and the firm stays</text>
              <text x="1166" y="213" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">on the record</text>

              <rect x="256" y="344" width="430" height="76" fill="none" stroke="#D4A84B" strokeWidth="1.2" strokeDasharray="5 4" />
              <text x="471" y="376" textAnchor="middle" fill="#D4A84B" fontSize="13.5" fontWeight="600">It stands down and a practitioner</text>
              <text x="471" y="395" textAnchor="middle" fill="#D4A84B" fontSize="13.5" fontWeight="600">takes the matter by hand</text>

              <line x1="178" y1="190" x2="250" y2="190" stroke="#FAFAF8" strokeWidth="1.2" markerEnd="url(#lpArrow)" />
              <text x="214" y="180" textAnchor="middle" fill="rgba(250,250,248,0.62)" fontSize="10">in your words</text>

              <line x1="432" y1="190" x2="504" y2="190" stroke="#FAFAF8" strokeWidth="1.2" markerEnd="url(#lpArrow)" />
              <text x="468" y="180" textAnchor="middle" fill="rgba(250,250,248,0.62)" fontSize="10">facts confirmed</text>

              <line x1="686" y1="190" x2="794" y2="190" stroke="#FAFAF8" strokeWidth="1.2" markerEnd="url(#lpArrow)" />
              <text x="740" y="248" textAnchor="middle" fill="rgba(250,250,248,0.62)" fontSize="10">handed off</text>

              <line x1="992" y1="190" x2="1064" y2="190" stroke="#D4A84B" strokeWidth="1.6" markerEnd="url(#lpArrowGold)" />
              <text x="1028" y="180" textAnchor="middle" fill="#D4A84B" fontSize="10">signed</text>

              <path d="M880 144 L880 96 L598 96 L598 144" fill="none" stroke="#D4A84B" strokeWidth="1.3" markerEnd="url(#lpArrowGold)" />
              <text x="739" y="88" textAnchor="middle" fill="#D4A84B" fontSize="10">returned for correction</text>

              <path d="M344 230 L344 338" fill="none" stroke="#D4A84B" strokeWidth="1.3" strokeDasharray="5 4" markerEnd="url(#lpArrowGold)" />
              <text x="356" y="272" fill="#D4A84B" fontSize="10">disputed ownership, fraud,</text>
              <text x="356" y="288" fill="#D4A84B" fontSize="10">litigation, over the limit</text>

              <path d="M686 382 L896 382 L896 240" fill="none" stroke="#D4A84B" strokeWidth="1.3" strokeDasharray="5 4" markerEnd="url(#lpArrowGold)" />
              <text x="790" y="372" textAnchor="middle" fill="#D4A84B" fontSize="10">straight to a human</text>
            </svg>
          </figure>
        </div>
      </section>

      {/* ══ THE TWO AGENTS ══ */}
      <section className="lp-section lp-container" id="services" aria-label="What we take today">
        <h2 className="lp-h2 lp-section-head">Two matters we take today.</h2>

        <div className="lp-agents">
          {AGENTS_LIVE.map((agent, i) => (
            <Reveal key={agent.id} delay={i * 80}>
              <div className="lp-agent">
                <div className="lp-agent-img">
                  <img src={agent.img} alt={agent.alt} loading="lazy" />
                </div>

                <div className="lp-agent-head">
                  <h3>{agent.name}</h3>
                  <span className="lp-eyebrow">{agent.price}</span>
                </div>

                <div className="lp-agent-body">
                  {agent.openers.map((q) => <p key={q} className="lp-quote-line">{q}</p>)}

                  <div className="lp-chips">
                    {agent.outputs.map((o) => <span key={o} className="lp-chip">{o}</span>)}
                  </div>
                </div>

                <div className="lp-agent-foot">
                  <p>{agent.lawyer}</p>
                  <button type="button" className="btn btn-primary btn-block" onClick={() => onOpenAgent(agent.id)}>
                    {agent.cta}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="lp-note">
          Judgment Enforcement, Lawyer Consultation, Contracts and CAC Registration open as capacity
          allows.{' '}
          <button type="button" className="lp-inlinelink" onClick={onStartCustomClaim}>Tell us</button>{' '}
          if you need one today.
        </p>
      </section>

      {/* ══ THE FENCES ══ */}
      <section className="lp-section lp-muted" aria-label="What keeps it honest">
        <div className="lp-container lp-aside">
          <h2 className="lp-h2">Fenced in on purpose.</h2>

          <div>
            {FENCES.map((fence, i) => (
              <div key={fence.n} className={`lp-row-num${i === 0 ? ' lp-row-first' : ''}`}>
                <div className="lp-eyebrow lp-eyebrow-accent">{fence.n}</div>
                <div>
                  <h3>{fence.title}</h3>
                  <p>{fence.body}</p>
                </div>
              </div>
            ))}

            <div className="lp-ladder">
              {NOTICE_LADDER.map((row) => (
                <div key={row.type} className={row.highlight ? 'lp-ladder-cell is-on' : 'lp-ladder-cell'}>
                  <div className="lp-eyebrow">{row.type}</div>
                  <div className="lp-ladder-val">{row.period}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ THE FIRM ══ */}
      <section className="lp-section lp-container" aria-label="The firm">
        <h2 className="lp-h2 lp-section-head">A real firm, on the record.</h2>

        <div className="lp-tri">
          {FIRM.map((item) => (
            <div key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEES ══ */}
      <section className="lp-section lp-muted" id="pricing" aria-label="Fees">
        <div className="lp-container lp-aside">
          <h2 className="lp-h2">No retainer.<br />No hourly rate.</h2>

          <div>
            {FEES.map((fee, i) => (
              <div key={fee.label} className={`lp-row${i === 0 ? ' lp-row-first' : ''}`}>
                <span style={{ color: fee.muted ? 'var(--text-2)' : 'var(--text-1)' }}>{fee.label}</span>
                <span className="lp-row-val" style={{ color: fee.accent ? 'var(--accent)' : fee.muted ? 'var(--text-2)' : 'var(--text-1)' }}>
                  {fee.value}
                </span>
              </div>
            ))}
            <p className="lp-note">Filing fees are quoted exactly before you pay them. We take no margin.</p>
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="lp-section lp-dark" aria-label="Start a matter">
        <div className="lp-container lp-hero-grid" style={{ alignItems: 'end' }}>
          <h2 className="lp-h2" style={{ color: 'var(--bg-0)' }}>
            Start with the problem,<br />not the paperwork.
          </h2>

          <div className="lp-cta-stack">
            <button type="button" className="lp-cta lp-cta-invert" onClick={() => onOpenAgent(PROPERTY_AGENT)}>
              <div className="lp-cta-title">I have a property matter</div>
              <div className="lp-cta-sub">Tenancy, lease, deed, transfer or title</div>
            </button>
            <button type="button" className="lp-cta lp-cta-ghost" onClick={() => onOpenAgent(DEBT_AGENT)}>
              <div className="lp-cta-title">Someone owes me money</div>
              <div className="lp-cta-sub">Demand letter through to court</div>
            </button>
            {user ? (
              <button type="button" className="lp-textlink is-invert" onClick={copyReferralLink}>
                {referralCopied ? 'Referral link copied' : 'Copy your referral link'}
              </button>
            ) : (
              <button type="button" className="lp-textlink is-invert" onClick={onRequestAuth}>
                Sign in &rarr;
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
