'use client'

import { useState } from 'react'
import Reveal from './Reveal'

/* ─────────────────────────────────────────────────────────────
   Homepage — 2026 rebuild.

   The firm is no longer positioned around debt recovery. The subject is
   the model itself: an agent does the intake, the analysis and the first
   draft; a licensed practitioner reviews, corrects and signs; the firm
   carries the matter through service, filing and court.

   Everything factual here is drawn from lib/agents.ts and
   lib/agentCapabilities.ts — the nine property instruments, the escalation
   triggers, the refusals, the notice ladder. Nothing is invented: no
   testimonials, no client logos, no case counts, and deliberately no
   accuracy statistics, because none have ever been measured (see the note
   at the top of lib/agentCapabilities.ts).

   Styles live under .lp- in app/globals.css.
   ───────────────────────────────────────────────────────────── */

const PROPERTY_AGENT = 'recovery-of-premises'
const DEBT_AGENT = 'small-claims'

const PROPERTY_OPENERS = [
  '“My tenant hasn’t paid since January and I want him out.”',
  '“I’m buying land in Ikorodu. Can you check the title first?”',
  '“I need a tenancy agreement for a three-year lease.”',
]

const DEBT_OPENERS = [
  '“My business partner took the client payment and never paid my share.”',
  '“I delivered the job in March and the invoice is still unpaid.”',
  '“I won in court last year and he still hasn’t paid me.”',
]

const PROPERTY_OUTPUTS = [
  'NOTICE TO QUIT', 'SEVEN DAYS’ NOTICE', 'TENANCY / LEASE', 'DEED OF ASSIGNMENT',
  'DEED OF GIFT', 'DEED OF MORTGAGE', 'POWER OF ATTORNEY', 'SALE OF LAND', 'TITLE SEARCH REPORT',
]

const DEBT_OUTPUTS = [
  'LETTER OF DEMAND', 'EVIDENCE REVIEW', 'DAY 7 / DAY 14 FOLLOW-UP', 'SMALL CLAIMS FILING', 'COURT REPRESENTATION',
]

const NOTICE_LADDER = [
  { type: 'Weekly, or tenant at will', period: '1 week' },
  { type: 'Monthly', period: '1 month' },
  { type: 'Quarterly, or half-yearly', period: '3 months' },
  { type: 'Yearly', period: '6 months', highlight: true },
]

const FENCES = [
  {
    n: '01',
    title: 'It fills templates. It does not compose documents.',
    body: 'Every draft starts from the firm’s own vetted template for that exact document type and is filled in. Clauses are not restructured freehand, and anything outside the covered types is escalated rather than improvised.',
  },
  {
    n: '02',
    title: 'It establishes the state before it advises.',
    body: 'Property law in Nigeria is state law. Lagos means the Lagos State Tenancy Law 2011; Ogun and the FCT mean something else. The agent confirms jurisdiction before touching notice periods or Governor’s Consent, rather than assuming Lagos.',
  },
  {
    n: '04',
    title: 'It says “I don’t know” instead of filling the gap.',
    body: 'It will not produce a C of O number, a plot number, a consideration figure, a CAC form number or a statute section you have not given it. Where it is unsure of a section, it names the instrument instead of inventing the number.',
  },
]

const FEES = [
  { label: 'Any property document: notice, tenancy, deed, power of attorney, title search', value: '₦5,000' },
  { label: 'Letter of demand, drafted and lawyer-reviewed, yours to serve', value: '₦10,000' },
  { label: 'The same letter, served on the debtor by Pandas LP', value: '₦25,000' },
  { label: 'Day 7 and Day 14 follow-ups on a served letter', value: 'Included', accent: true },
  { label: 'Court filing fees, where a matter goes that far', value: 'Set by the court', muted: true },
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
      <section className="lp-section lp-container" style={{ paddingTop: 104 }} aria-label="Pandas LP">
        <div className="lp-eyebrow">An AI-native law firm &nbsp;·&nbsp; Lagos, Nigeria</div>

        <h1 className="lp-h1">
          AI does the legal work.<br />
          <span style={{ fontStyle: 'italic', fontWeight: 400 }}>A lawyer is still answerable for it.</span>
        </h1>

        <div className="lp-hero-grid">
          <div>
            <p className="lp-lede" style={{ maxWidth: 620 }}>
              An agent grounded in Nigerian law drafts your matter. A practitioner reviews it, signs it,
              and the firm takes it to court.
            </p>
          </div>

          <div className="lp-cta-stack">
            <button type="button" className="lp-cta lp-cta-dark" onClick={() => onOpenAgent(PROPERTY_AGENT)}>
              <div className="lp-cta-title">I have a property matter</div>
              <div className="lp-cta-sub">Tenancy, lease, deed, transfer or title</div>
            </button>
            <button type="button" className="lp-cta lp-cta-line" onClick={() => onOpenAgent(DEBT_AGENT)}>
              <div className="lp-cta-title">Someone owes me money</div>
              <div className="lp-cta-sub">Demand letter through to court</div>
            </button>
            <button
              type="button"
              onClick={onStartLawyerConsult}
              style={{ background: 'none', border: 'none', padding: '6px 2px', textAlign: 'left', fontSize: 15.5, color: 'var(--text-2)' }}
            >
              Not sure which? Speak to a lawyer first &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* ══ CREDENTIALS ══ */}
      <div className="lp-container" style={{ paddingBottom: 44 }}>
        <div className="lp-credentials">
          <span>CAC BN 9646741</span>
          <span>NBA notified</span>
          <span>Two agents live</span>
          <span>You read the draft before you pay</span>
        </div>
      </div>

      {/* ══ EDITORIAL BAND ══ */}
      <div className="lp-band">
        <img
          className="lp-drift"
          src="/img/img-hero.jpg"
          alt="A signed letter on firm letterhead, a fountain pen and a brass seal"
          loading="lazy"
        />
        <div className="lp-band-scrim" aria-hidden="true" />
        <div className="lp-container" style={{ position: 'absolute', left: 0, right: 0, bottom: 34 }}>
          <p className="lp-band-quote" style={{ position: 'static' }}>
            The signature is not a formality. It is the product.
          </p>
        </div>
      </div>

      {/* ══ WHY WE REBUILT ══ */}
      <section className="lp-section lp-muted" aria-label="Why Pandas LP exists">
        <div className="lp-container">
          <Reveal>
            <div style={{ maxWidth: 860, marginBottom: 56 }}>
              
              <h2 className="lp-h2" style={{ marginBottom: 22 }}>
                Legal help in Nigeria is either<br />hard to reach or nobody&rsquo;s responsibility.
              </h2>
              <p style={{ fontSize: 18, lineHeight: 1.68, color: 'var(--text-2)' }}>
                Both existing options are genuinely good at something. Neither is good at the whole job.
              </p>
            </div>
          </Reveal>

          <div className="lp-tri">
            <div>
              <div className="lp-eyebrow" style={{ marginBottom: 16, fontSize: 10, letterSpacing: '0.16em' }}>A TRADITIONAL FIRM</div>
              <h3 style={{ fontSize: 22, lineHeight: 1.28, marginBottom: 14 }}>Real accountability, behind a door most people never get through.</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)' }}>
                The expertise is real and someone is answerable for it. But you have to secure a retainer
                conversation, work to office hours, and accept a bill you cannot forecast. Plenty of people
                with a legitimate claim simply never begin.
              </p>
            </div>
            <div>
              <div className="lp-eyebrow" style={{ marginBottom: 16, fontSize: 10, letterSpacing: '0.16em' }}>A GENERAL AI CHATBOT</div>
              <h3 style={{ fontSize: 22, lineHeight: 1.28, marginBottom: 14 }}>Instantly available, and nobody&rsquo;s name is on the answer.</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)' }}>
                It will answer at 2am and cost you nothing, which is not a small thing. But it cannot serve
                a notice, file at a registry, appear before a judge, or be answerable to you or the Bar when
                it is confidently wrong about your state&rsquo;s tenancy law.
              </p>
            </div>
            <div>
              <div className="lp-eyebrow lp-eyebrow-accent" style={{ marginBottom: 16, fontSize: 10, letterSpacing: '0.16em' }}>PANDAS LP</div>
              <h3 style={{ fontSize: 22, lineHeight: 1.28, marginBottom: 14 }}>The reach of the second, with the responsibility of the first.</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.72, color: '#4A4A48' }}>
                An agent takes your matter whenever you bring it, in whatever words you have, at a price
                quoted before you start. Then a practitioner reviews it and puts their name on it, so
                there is a firm standing behind the document, not a model.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══ THE MODEL ══ */}
      <section className="lp-section lp-dark" id="how-it-works" aria-label="How the model works">
        <div className="lp-container">
          <div style={{ maxWidth: 820, marginBottom: 52 }}>
            <div className="lp-eyebrow lp-eyebrow-accent" style={{ marginBottom: 20 }}>What &ldquo;AI-native&rdquo; actually means here</div>
            <h2 className="lp-h2" style={{ color: 'var(--bg-0)', marginBottom: 22 }}>
              The AI is not a feature bolted onto the firm. It is the intake, the analysis and the first draft.
            </h2>
            <p className="lp-lede">
              And it stops at a hard line. Below is the actual route your matter takes, including the two
              paths people never show you: what happens when the agent decides it should not be handling
              your matter at all, and what happens when the reviewing lawyer sends the draft back.
            </p>
          </div>

          <figure style={{ margin: 0 }}>
            <svg
              className="lp-diagram"
              viewBox="0 0 1264 470"
              role="img"
              aria-label="A matter moves from the client through the agent's interview and drafting to a licensed practitioner, who is the only route to the outside world. Two side paths: escalation triggers send a matter straight to a practitioner, and a reviewed draft can be returned to the agent for correction."
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
              <text x="742" y="20" textAnchor="middle" fill="#D4A84B" fontFamily="var(--font-mono), monospace" fontSize="11.5" letterSpacing="1.6">
                NOTHING CROSSES THIS LINE UNSIGNED
              </text>

              {/* the matter itself, passing behind each stage and emerging signed.
                  SMIL cannot be gated by a CSS media query, so reduced-motion hides it
                  and the diagram degrades to its static form. */}
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
              <text x="344" y="182" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">The agent runs</text>
              <text x="344" y="201" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">the interview</text>

              <rect x="510" y="150" width="176" height="80" fill="#141414" stroke="#FAFAF8" strokeWidth="1.2" />
              <text x="598" y="182" textAnchor="middle" fill="#FAFAF8" fontSize="13.5" fontWeight="600">It drafts from the</text>
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
              <text x="471" y="376" textAnchor="middle" fill="#D4A84B" fontSize="13.5" fontWeight="600">The agent stands down and a practitioner</text>
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
              <text x="356" y="266" fill="#D4A84B" fontSize="10">disputed ownership &middot; fraud &middot;</text>
              <text x="356" y="282" fill="#D4A84B" fontSize="10">active litigation &middot; over the</text>
              <text x="356" y="298" fill="#D4A84B" fontSize="10">Small Claims limit</text>

              <path d="M686 382 L896 382 L896 240" fill="none" stroke="#D4A84B" strokeWidth="1.3" strokeDasharray="5 4" markerEnd="url(#lpArrowGold)" />
              <text x="790" y="372" textAnchor="middle" fill="#D4A84B" fontSize="10">straight to a human</text>
            </svg>

            <figcaption style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(250,250,248,0.58)', marginTop: 32, maxWidth: 900 }}>
              Every route out of the agent ends at the same place. There is no path in this diagram where a
              document reaches a tenant, a debtor or a court without a licensed practitioner having read it
              and signed it. That includes the escalation path, where the agent decides the matter is not one
              it should be handling and hands it over before drafting anything.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ══ THE TWO AGENTS ══ */}
      <section className="lp-section lp-container" id="services" aria-label="Our legal agents">
        <div style={{ paddingBottom: 26, borderBottom: '2px solid var(--text-1)', marginBottom: 48 }}>
          <div className="lp-eyebrow lp-eyebrow-accent" style={{ marginBottom: 18 }}>Live now</div>
          <h2 className="lp-h2">Two agents you can talk to today.</h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-2)', maxWidth: 620, marginTop: 16 }}>
            Debt recovery is where the firm started. Property law is the same model applied to a second
            practice area, and the proof that it travels.
          </p>
        </div>

        <div className="lp-agents">
          {[
            {
              id: PROPERTY_AGENT,
              name: 'Property Law Agent',
              price: '₦5,000 / DOCUMENT',
              blurb: 'Nine distinct Nigerian property-law document types, handled end to end from one conversation, instead of a separate consultation for each.',
              openers: PROPERTY_OPENERS,
              outputs: PROPERTY_OUTPUTS,
              lawyer: 'every document type is checked against its own reviewer checklist (Governor’s Consent clause present, correct execution block for a company or an attorney) before it can be marked reviewed.',
              cta: 'Talk to the Property Law Agent',
            },
            {
              id: DEBT_AGENT,
              name: 'Debt Recovery Agent',
              price: 'FROM ₦10,000',
              blurb: 'From the first demand letter through to filing at the Small Claims Court, with the follow-through that usually gets abandoned handled for you.',
              openers: DEBT_OPENERS,
              outputs: DEBT_OUTPUTS,
              lawyer: 'a practitioner signs the letter before it is served, and takes the matter over entirely if the debt exceeds the Small Claims limit, liability is disputed, or there is any suggestion of fraud.',
              cta: 'Talk to the Debt Recovery Agent',
            },
          ].map((agent, i) => (
            <Reveal key={agent.id} delay={i * 80}>
              <div className="lp-agent">
                <div style={{ padding: '30px 34px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <span className="lp-eyebrow lp-eyebrow-accent" style={{ fontSize: 10, letterSpacing: '0.16em' }}>&#9679; LIVE</span>
                    <span className="lp-eyebrow" style={{ fontSize: 11 }}>{agent.price}</span>
                  </div>
                  <h3 style={{ fontSize: 30, letterSpacing: '-0.022em', marginBottom: 12 }}>{agent.name}</h3>
                  <p style={{ fontSize: 16, lineHeight: 1.68, color: 'var(--text-2)', marginBottom: 26 }}>{agent.blurb}</p>
                </div>

                <div style={{ padding: '0 34px 24px' }}>
                  <div className="lp-eyebrow" style={{ fontSize: 9.5, letterSpacing: '0.16em', marginBottom: 12 }}>THINGS PEOPLE ACTUALLY OPEN WITH</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {agent.openers.map((q) => <div key={q} className="lp-quote-line">{q}</div>)}
                  </div>
                </div>

                <div style={{ padding: '0 34px 26px' }}>
                  <div className="lp-eyebrow" style={{ fontSize: 9.5, letterSpacing: '0.16em', marginBottom: 12 }}>WHAT COMES OUT</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {agent.outputs.map((o) => <span key={o} className="lp-chip">{o}</span>)}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', padding: '22px 34px 26px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-0)' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
                    <strong style={{ color: 'var(--text-1)' }}>Where the lawyer comes in:</strong> {agent.lawyer}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => onOpenAgent(agent.id)}
                  >
                    {agent.cta}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p style={{ fontSize: 15.5, lineHeight: 1.7, color: 'var(--text-2)', marginTop: 36, maxWidth: 760 }}>
          Judgment Enforcement, Lawyer Consultation, Contracts &amp; Commercial and CAC Registration are
          written and priced, and open as practitioner capacity allows. Need one of them today?{' '}
          <button
            type="button"
            onClick={onStartCustomClaim}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent-deep)', borderBottom: '1px solid var(--border-focus)' }}
          >
            Tell us
          </button>{' '}
          and a practitioner will take it by hand.
        </p>
      </section>

      {/* ══ WHAT KEEPS IT HONEST ══ */}
      <section className="lp-section lp-muted" aria-label="What keeps the agent honest">
        <div className="lp-container lp-aside">
          <div>
            
            <h2 className="lp-h2" style={{ marginBottom: 22 }}>The agent is fenced in on purpose.</h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-2)' }}>
              A general model will cheerfully invent a section number. These agents are built so that the
              tempting failures are structurally unavailable to them.
            </p>
          </div>

          <div>
            <div className="lp-row-num lp-row-first">
              <div className="lp-eyebrow lp-eyebrow-accent" style={{ fontSize: 12, paddingTop: 2 }}>{FENCES[0].n}</div>
              <div>
                <h3 style={{ fontSize: 20, marginBottom: 8 }}>{FENCES[0].title}</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)' }}>{FENCES[0].body}</p>
              </div>
            </div>
            <div className="lp-row-num">
              <div className="lp-eyebrow lp-eyebrow-accent" style={{ fontSize: 12, paddingTop: 2 }}>{FENCES[1].n}</div>
              <div>
                <h3 style={{ fontSize: 20, marginBottom: 8 }}>{FENCES[1].title}</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)' }}>{FENCES[1].body}</p>
              </div>
            </div>

            <div className="lp-row-num">
              <div className="lp-eyebrow lp-eyebrow-accent" style={{ fontSize: 12, paddingTop: 2 }}>03</div>
              <div>
                <h3 style={{ fontSize: 20, marginBottom: 8 }}>It knows the periods that void a document.</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)', marginBottom: 16 }}>
                  A one-month notice served on a yearly tenancy is void. The landlord waits, gets nowhere,
                  and starts again. The statutory ladder is fixed in the agent&rsquo;s instructions, not inferred
                  each time.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', border: '1px solid var(--border-focus)', background: 'var(--bg-2)' }}>
                  {NOTICE_LADDER.map((row) => (
                    <div
                      key={row.type}
                      style={{
                        flex: '1 1 150px',
                        padding: '13px 16px',
                        borderRight: '1px solid var(--border-subtle)',
                        background: row.highlight ? 'var(--text-1)' : 'transparent',
                      }}
                    >
                      <div className="lp-eyebrow" style={{ fontSize: 9.5, letterSpacing: '0.13em', color: row.highlight ? 'var(--accent-hover)' : 'var(--text-3)' }}>
                        {row.type.toUpperCase()}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: 19, marginTop: 4, color: row.highlight ? 'var(--bg-0)' : 'var(--text-1)' }}>
                        {row.period}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lp-row-num" style={{ borderBottom: '1px solid var(--border-focus)' }}>
              <div className="lp-eyebrow lp-eyebrow-accent" style={{ fontSize: 12, paddingTop: 2 }}>{FENCES[2].n}</div>
              <div>
                <h3 style={{ fontSize: 20, marginBottom: 8 }}>{FENCES[2].title}</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)' }}>{FENCES[2].body}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ THE FIRM ══ */}
      <section className="lp-section lp-container" aria-label="The firm">
        <div className="lp-split" style={{ marginBottom: 54 }}>
          <div style={{ maxWidth: 760 }}>
            
            <h2 className="lp-h2" style={{ marginBottom: 22 }}>A real firm, on the record.</h2>
            <p style={{ fontSize: 18, lineHeight: 1.68, color: 'var(--text-2)' }}>
              Pandas LP is registered with the Corporate Affairs Commission as a business name, BN 9646741,
              and the Nigerian Bar Association has been notified. Our practitioners do not merely proofread
              the AI&rsquo;s output. They serve notices, file at courts and appear before them.
            </p>
          </div>
          <div style={{ overflow: 'hidden', height: 300 }}>
            <img
              className="lp-drift"
              src="/img/img-nib.jpg"
              alt="A fountain pen nib resting on cotton legal paper"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              loading="lazy"
            />
          </div>
        </div>

        <div className="lp-tri">
          <div>
            <h3 style={{ fontSize: 21, lineHeight: 1.3, marginBottom: 12 }}>Review is a checklist, not a tick-box</h3>
            <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)' }}>
              Each document type carries its own reviewer checklist: is the Governor&rsquo;s Consent clause
              present, is the execution block right for a company rather than an individual, do the figures
              reconcile. A draft cannot be marked reviewed until they are answered.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 21, lineHeight: 1.3, marginBottom: 12 }}>Some matters never reach the agent</h3>
            <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)' }}>
              Disputed ownership, squatters, active litigation, a debt above the Small Claims limit, a
              counterclaim, any hint of fraud, a client intending to skip Governor&rsquo;s Consent. On any of those the agent is
              instructed to stop and hand over, not to attempt it.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 21, lineHeight: 1.3, marginBottom: 12 }}>We don&rsquo;t quote accuracy figures</h3>
            <p style={{ fontSize: 15.5, lineHeight: 1.72, color: 'var(--text-2)' }}>
              You will not find a &ldquo;99% accurate&rdquo; badge here, because no such measurement has been made.
              When we have tested these agents properly, we will publish what we actually found. Until then
              the honest claim is the one above: a lawyer reads everything.
            </p>
          </div>
        </div>
      </section>

      {/* ══ FEES ══ */}
      <section className="lp-section lp-muted" id="pricing" aria-label="Fees">
        <div className="lp-container lp-aside">
          <div>
            
            <h2 className="lp-h2" style={{ marginBottom: 20 }}>Priced per matter,<br />quoted before you start.</h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.7, color: 'var(--text-2)' }}>
              No retainer, no hourly billing, no invoice that arrives larger than the conversation
              suggested. You see the draft before you are asked to pay for it.
            </p>
          </div>

          <div>
            {FEES.map((fee, i) => (
              <div key={fee.label} className={`lp-row${i === 0 ? ' lp-row-first' : ''}`} style={i === FEES.length - 1 ? { borderBottom: '1px solid var(--border-focus)' } : undefined}>
                <span style={{ fontSize: 17.5, color: fee.muted ? 'var(--text-2)' : 'var(--text-1)' }}>{fee.label}</span>
                <span
                  className="label-mono"
                  style={{
                    fontSize: fee.muted ? 15 : 17,
                    textAlign: 'right',
                    color: fee.accent ? 'var(--accent)' : fee.muted ? 'var(--text-2)' : 'var(--text-1)',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                  }}
                >
                  {fee.value}
                </span>
              </div>
            ))}
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-3)', marginTop: 22, maxWidth: 680 }}>
              Filing fees vary by claim amount and jurisdiction. We quote the exact figure before you pay it
              and take no margin on it. Matters that escalate to a practitioner are quoted separately, in
              advance, before any work begins.
            </p>
          </div>
        </div>
      </section>

      {/* ══ REFERRAL ══ */}
      <section className="lp-container" style={{ padding: '48px 32px' }} aria-label="Refer a friend">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between', paddingTop: 28, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ fontSize: 20, marginBottom: 6 }}>Know someone this would help?</h3>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-2)' }}>
              Share your link. We track every referral. Reward details are coming, and your invites count
              from day one.
            </p>
          </div>
          {user ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <code style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 13, color: 'var(--text-2)', background: 'var(--bg-1)', border: '1px solid var(--border-subtle)', padding: '10px 14px', overflowWrap: 'anywhere' }}>
                {referralLink}
              </code>
              <button type="button" className="btn btn-primary" onClick={copyReferralLink}>
                {referralCopied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-outline" onClick={onRequestAuth}>
              Sign in for your referral link
            </button>
          )}
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="lp-section lp-dark" aria-label="Start a matter">
        <div className="lp-container lp-hero-grid" style={{ paddingBottom: 0, alignItems: 'end' }}>
          <div>
            <h2 className="lp-h2" style={{ color: 'var(--bg-0)', marginBottom: 24, fontSize: 'clamp(32px, 4.4vw, 58px)', lineHeight: 1.03 }}>
              Start with the problem,<br />not the paperwork.
            </h2>
            <p className="lp-lede" style={{ maxWidth: 580 }}>
              Describe what has happened in your own words. The agent works out what the matter needs, a
              practitioner checks and signs it, and the firm carries it the rest of the way.
            </p>
          </div>
          <div className="lp-cta-stack">
            <button type="button" className="lp-cta lp-cta-invert" onClick={() => onOpenAgent(PROPERTY_AGENT)}>
              <div className="lp-cta-title">I have a property matter</div>
              <div className="lp-cta-sub">Tenancy, lease, deed, transfer or title</div>
            </button>
            <button type="button" className="lp-cta lp-cta-ghost" onClick={() => onOpenAgent(DEBT_AGENT)}>
              <div className="lp-cta-title">Someone owes me money</div>
              <div className="lp-cta-sub">Demand letter through to court</div>
            </button>
            <button
              type="button"
              onClick={onStartLawyerConsult}
              style={{ background: 'none', border: 'none', padding: '6px 2px', textAlign: 'left', fontSize: 15.5, color: 'rgba(250,250,248,0.62)' }}
            >
              Not sure which? Speak to a lawyer first &rarr;
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
