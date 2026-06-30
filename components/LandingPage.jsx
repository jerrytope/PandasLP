'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  MessageSquare, FileText, Send, Scale, Shield, Clock,
  TrendingUp, ChevronDown, CheckCircle, ArrowUpRight,
  Sparkles, Users, Zap, Gavel, Building2, Briefcase,
  CalendarCheck, Bell, Brain, Eye, AlertTriangle, Heart
} from 'lucide-react'
import Reveal from './Reveal'

/* ── Services config ── */
const TESTING_SERVICES = [
  {
    id: 'judgment-enforcement',
    icon: <Gavel size={20} strokeWidth={1.5} />,
    name: 'Judgment Enforcement',
    shortName: 'Enforce a judgment',
    description: 'Already won in court but the debtor won\'t pay? We file a Garnishee Order or Writ of Execution to compel payment.',
    price: '₦10,000 + 5% of judgment',
    color: '#b03a2e',
  },
  {
    id: 'lawyer-consultation',
    icon: <CalendarCheck size={20} strokeWidth={1.5} />,
    name: 'Lawyer Consultation',
    shortName: 'Speak to a lawyer',
    description: 'Book a 45-minute session with a licensed Nigerian lawyer. Get real legal advice, not AI-generated answers.',
    price: '₦15,000 per session',
    color: '#2a7d4f',
  },
]

const COMING_SOON_SERVICES = [
  {
    id: 'recovery-of-premises',
    icon: <Building2 size={20} strokeWidth={1.5} />,
    name: 'Recovery of Premises',
    description: 'Tenant won\'t leave after notice? We prepare your eviction letter and file at the Rent Tribunal.',
    color: '#1d6fa4',
  },
  {
    id: 'contracts',
    icon: <Briefcase size={20} strokeWidth={1.5} />,
    name: 'Contracts & Commercial',
    description: 'Draft or review business agreements, NDAs, service contracts, and partnership deeds.',
    color: '#6b4fc9',
  },
  {
    id: 'cac-registration',
    icon: <Shield size={20} strokeWidth={1.5} />,
    name: 'CAC Registration',
    description: 'Register your business with the Corporate Affairs Commission. Business name or full incorporation.',
    color: '#c97a1a',
  },
]

/* ── Trust badges marquee items ── */
const TRUST_BADGES = [
  { label: 'CAC Registered' },
  { label: 'AI-Powered Documents' },
  { label: 'Licensed Lawyers' },
  { label: 'Supabase Encrypted' },
  { label: 'Paystack Secure' },
  { label: 'Court Filing Included' },
  { label: '10-Minute Process' },
]

/* ── FAQ data ── */
const FAQ_TABS = ['Getting Started', 'Pricing', 'Legal Process', 'Security']

const FAQ_DATA = {
  'Getting Started': [
    { q: 'Is Pandas LP a real law firm?', a: 'Yes. Pandas LP is a registered company with the Nigerian Corporate Affairs Commission (CAC). Our AI agents draft your documents; our licensed lawyers review, serve, and file them.' },
    { q: 'How quickly can I get started?', a: 'Most clients complete the AI interview and receive a draft demand letter in under 10 minutes. From there, you\'ll review, pay, and Pandas LP serves the letter within 24 business hours.' },
    { q: 'Do I need to know anything about law?', a: 'Not at all. Our AI agent asks you plain-English questions about who owes you, how much, and why. You answer in your own words. The AI handles the legal language.' },
  ],
  'Pricing': [
    { q: 'How much does it cost?', a: 'A demand letter starts from ₦10,000 (self-serve PDF). If you want Pandas LP to serve the letter on the debtor on your behalf, that\'s ₦25,000. Court filing fees are additional and vary by court.' },
    { q: 'Are there any hidden fees?', a: 'No. You see the full breakdown before you pay — nothing changes after. Court filing fees are set by the government and we quote them exactly.' },
    { q: 'How do I pay?', a: 'Securely via Paystack. We accept debit cards, credit cards, and bank transfers — all major Nigerian banks supported.' },
  ],
  'Legal Process': [
    { q: 'What happens after the demand letter is sent?', a: 'The debtor has 7 days to respond. You\'ll receive follow-up email updates at Day 3 and Day 7. If they ignore the letter, we escalate to court filing — no extra action needed from you.' },
    { q: 'Can you actually take them to court?', a: 'Yes. Pandas LP\'s lawyers can file your claim at the Lagos Small Claims Court (or relevant state court) and represent you. Judgment enforcement is also available if they win but still don\'t pay.' },
    { q: 'What types of debt can you recover?', a: 'Unpaid invoices, personal loans, service fees, contractor payments, salary arrears, rent deposits, and goods paid for but not delivered. If it\'s money owed and documentable, we can help.' },
  ],
  'Security': [
    { q: 'Is my information safe?', a: 'Yes. All case data is stored in Supabase with row-level security — meaning only you and your assigned lawyer can access your case. Your documents are never shared with third parties.' },
    { q: 'Who sees my case details?', a: 'Only you and the Pandas LP legal team assigned to your matter. Your AI conversation is confidential and used only to draft your legal documents.' },
  ],
}

/* ── Pricing calculator logic ── */
const DEMAND_FEE   = 10000
const LAWYER_EQUIV = 80000

/* ── Comparison rows ── */
const COMPARE = [
  { label: 'Time to start',       pandas: '10 minutes',           trad: '2–4 weeks',       diy: 'Weeks of research' },
  { label: 'Cost',                pandas: 'From ₦10,000',         trad: '₦50,000+',        diy: 'Free but risky' },
  { label: 'Legal expertise',     pandas: '✓ AI + lawyers',       trad: '✓ Lawyers only',  diy: '✗ None' },
  { label: 'Automated follow-up', pandas: '✓ Day 0, 3, 7',        trad: 'Manual',          diy: 'You chase them' },
  { label: 'Court filing',        pandas: '✓ Handled by us',      trad: '✓ Handled',       diy: '✗ Figure it out' },
  { label: 'Available',           pandas: '✓ 24 / 7',             trad: 'Office hours',    diy: 'When you can' },
]

export default function LandingPage({ onOpenAgent, onStartLawyerConsult, onStartCustomClaim }) {
  const [amount, setAmount]       = useState('')
  const [openFaq, setOpenFaq]     = useState(null)
  const [faqTab, setFaqTab]       = useState('Getting Started')

  // Notify me state: { [serviceId]: 'idle' | 'open' | 'submitting' | 'done' }
  const [notifyState, setNotifyState] = useState({})
  const [notifyEmails, setNotifyEmails] = useState({})

  async function handleNotifySubmit(serviceId, serviceName) {
    const email = notifyEmails[serviceId] || ''
    if (!email) return
    setNotifyState(s => ({ ...s, [serviceId]: 'submitting' }))
    try {
      await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service: serviceName, email }),
      })
    } catch {}
    setNotifyState(s => ({ ...s, [serviceId]: 'done' }))
  }

  const hasAmount = amount.replace(/[^0-9]/g, '').length > 0
  const savings   = LAWYER_EQUIV - DEMAND_FEE

  function formatNaira(v) {
    return '₦' + v.toLocaleString('en-NG')
  }

  function handleAmountInput(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setAmount(raw)
  }

  return (
    <>
      {/* ══ HERO ══ */}
      <section className="hero" aria-label="Hero">
        <div className="hero-glow" aria-hidden="true" />

        <div className="hero-grid container">
          {/* Left copy */}
          <div className="hero-copy">
            <div className="hero-eyebrow" style={{ animationDelay: '0s' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              Nigeria's first AI-native law firm
            </div>

            <h1 className="hero-headline" style={{ animation: 'fade-in-up 0.6s ease 0.1s both' }}>
              Your AI<br />
              legal team.
            </h1>

            <p className="hero-sub" style={{ animation: 'fade-in-up 0.6s ease 0.2s both' }}>
              Recover what you're owed. AI drafts the demand letter,
              real lawyers take it to court. From ₦10,000.
            </p>

            <div className="hero-actions" style={{ animation: 'fade-in-up 0.6s ease 0.3s both' }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => onOpenAgent('small-claims')}
              >
                Recover your money →
              </button>
              <a href="#how-it-works" className="btn btn-outline btn-lg">
                See how it works
              </a>
            </div>

            <div className="hero-trust" style={{ animation: 'fade-in-up 0.6s ease 0.4s both' }}>
              <span>CAC Registered</span>
              <span className="hero-trust-dot" />
              <span>AI-Powered</span>
              <span className="hero-trust-dot" />
              <span>Real Lawyers</span>
              <span className="hero-trust-dot" />
              <span>10-Minute Process</span>
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div className="phone-mockup-wrap" aria-hidden="true">
            <div className="phone-mockup">
              <div className="phone-notch-bar"><div className="phone-notch" /></div>
              <div className="phone-header">
                <div className="phone-header-dot" />
                <span className="phone-header-text">Pandas AI · Small Claims Agent</span>
              </div>
              <div className="phone-chat">
                <div className="phone-bubble phone-bubble-ai">
                  Hello! How much money are you owed, and who owes it?
                </div>
                <div className="phone-bubble phone-bubble-user">
                  John owes me ₦450,000 for consulting work from March.
                </div>
                <div className="phone-bubble phone-bubble-ai">
                  Got it. Do you have a written agreement or invoice?
                </div>
                <div className="phone-bubble phone-bubble-user">
                  Yes, I have an invoice and WhatsApp messages confirming.
                </div>
                <div className="phone-bubble phone-bubble-ai">
                  Perfect — that's strong evidence. Let me draft your Letter of Demand.
                </div>
                <div className="typing-dots" style={{ paddingLeft: 4 }}>
                  <span /><span /><span />
                </div>
              </div>
            </div>

            <div className="phone-status-card">
              <div className="phone-status-title">✓ Demand Letter Sent</div>
              <div className="phone-status-sub">Served on debtor · Day 0 of 7</div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ MARQUEE ══ */}
      <div className="marquee-wrap" style={{ padding: '20px 0', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} aria-hidden="true">
        <div className="marquee-track marquee-track-left">
          {[...TRUST_BADGES, ...TRUST_BADGES].map((b, i) => (
            <div key={i} className="marquee-item">
              <span className="marquee-item-dot" />
              {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* ══ HOW IT WORKS ══ */}
      <section className="section hiw-section" id="how-it-works" aria-label="How it works">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <span className="label-mono">Process</span>
              <h2>From dispute to resolution<br />in 3 steps</h2>
              <p>Our AI handles the paperwork. Our lawyers handle the court. You just answer a few questions.</p>
            </div>
          </Reveal>

          <div className="hiw-grid">
            {[
              {
                num: '01',
                icon: <MessageSquare size={22} strokeWidth={1.5} />,
                title: 'Tell us what happened',
                body: 'Answer a few questions about who owes you and how much. Upload invoices or contracts — our AI reads them and skips the questions it already knows the answers to.',
                detail: 'Average interview: 7 minutes',
              },
              {
                num: '02',
                icon: <FileText size={22} strokeWidth={1.5} />,
                title: 'AI drafts your demand letter',
                body: 'In under 10 minutes, our AI creates a court-ready Letter of Demand on Pandas LP letterhead — citing the correct Nigerian legal provisions. You preview it before paying.',
                detail: 'Free watermarked preview',
              },
              {
                num: '03',
                icon: <Send size={22} strokeWidth={1.5} />,
                title: 'We serve it and follow up',
                body: 'Pandas LP serves the letter on the debtor. Escalating follow-up emails go out at Day 3 and Day 7 automatically. If they ignore all three, we file your court claim.',
                detail: 'Day 0 → Day 3 → Day 7 → Court',
              },
            ].map((step, i) => (
              <Reveal key={step.num} delay={i * 100}>
                <div className="hiw-step-card">
                  <div className="hiw-step-num">{step.num}</div>
                  <div className="hiw-icon">{step.icon}</div>
                  <h3 className="hiw-step-title">{step.title}</h3>
                  <p className="hiw-step-body">{step.body}</p>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.05em' }}>
                    {step.detail}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AI INTELLIGENCE ══ */}
      <section className="section ai-intel-section" id="the-ai" aria-label="How the AI thinks">
        <div className="container">
          <Reveal>
            <div className="section-header">
              <span className="label-mono">The Intelligence</span>
              <h2>Not a form. Not a chatbot.<br />A trained legal mind.</h2>
              <p style={{ maxWidth: 560 }}>
                The interview is run by an AI trained on Nigerian legal procedure, debt recovery case law,
                and the exact questions a senior partner asks in a first consultation — minus the billable hours.
              </p>
            </div>
          </Reveal>

          {/* 4 feature tiles */}
          <div className="ai-features-grid">
            {[
              {
                icon: <Brain size={20} strokeWidth={1.5} />,
                iconBg: 'rgba(245,166,35,0.12)',
                iconColor: '#F5A623',
                tag: 'Structured Intake',
                title: 'Asks the right questions in the right order',
                body: 'The interview follows the same intake logic a senior litigator uses — debtor identity, relationship to the debt, contract terms, payment history, evidence quality, limitation period. Every time, in the right sequence, nothing skipped.',
              },
              {
                icon: <Eye size={20} strokeWidth={1.5} />,
                iconBg: 'rgba(62,207,142,0.12)',
                iconColor: '#3ECF8E',
                tag: 'Case Analysis',
                title: 'Spots the holes before the judge does',
                body: 'If your dates don\'t add up, it flags it. If your only evidence is a verbal promise, it tells you that\'s a weak case and explains why. It asks follow-up questions until your case is tight enough to put in front of a court.',
              },
              {
                icon: <Heart size={20} strokeWidth={1.5} />,
                iconBg: 'rgba(99,102,241,0.12)',
                iconColor: '#818CF8',
                tag: 'Tone & Mood Detection',
                title: 'Reads how you\'re feeling and adjusts',
                body: 'A client typing in short, angry fragments is probably at their limit. Someone who writes "I don\'t know if this will work" needs reassurance before they need information. The AI detects these signals and adjusts — calmer when you\'re stressed, more direct when you\'re ready to move.',
              },
              {
                icon: <Scale size={20} strokeWidth={1.5} />,
                iconBg: 'rgba(56,189,248,0.12)',
                iconColor: '#38BDF8',
                tag: 'Nigerian Law',
                title: 'Grounded in real Nigerian legal framework',
                body: 'The system is built on the Limitation Law of Lagos State, CAMA 2020, the Small Claims Court Civil Procedure Rules, and Nigerian digital evidence standards — not generic templates. It knows which court to file in, what threshold requires what evidence, and what the debtor\'s defences are likely to be.',
              },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="ai-feature-card">
                  <div className="ai-feature-icon" style={{ background: f.iconBg, color: f.iconColor }}>
                    {f.icon}
                  </div>
                  <h3 className="ai-feature-title">{f.title}</h3>
                  <p className="ai-feature-body">{f.body}</p>
                  <span className="ai-feature-tag">{f.tag}</span>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Live demo conversation */}
          <Reveal delay={160}>
            <div className="ai-demo-wrap" style={{ marginTop: 56 }}>
              <div className="ai-demo-header">
                <div className="ai-demo-dot" />
                <span className="ai-demo-label">Live interview · Small Claims Agent · Debt Recovery</span>
              </div>
              <div className="ai-demo-body">
                <div className="ai-demo-chat">
                  {/* Turn 1 */}
                  <div className="ai-demo-msg">
                    <span className="ai-demo-msg-sender">Pandas AI</span>
                    <div className="ai-demo-bubble ai-demo-bubble-ai">
                      Who owes you money, and what was it for?
                    </div>
                  </div>
                  <div className="ai-demo-msg" style={{ alignItems: 'flex-end' }}>
                    <span className="ai-demo-msg-sender" style={{ textAlign: 'right' }}>You</span>
                    <div className="ai-demo-bubble ai-demo-bubble-user">
                      my business partner. we did a construction job together and he took the client payment but never paid my share. about ₦1.2 million
                    </div>
                  </div>
                  {/* Turn 2 — legal precision */}
                  <div className="ai-demo-msg">
                    <span className="ai-demo-msg-sender">Pandas AI</span>
                    <div className="ai-demo-bubble ai-demo-bubble-ai">
                      Understood. Do you have a written partnership or profit-sharing agreement, or was this verbal?
                    </div>
                  </div>
                  <div className="ai-demo-msg" style={{ alignItems: 'flex-end' }}>
                    <span className="ai-demo-msg-sender" style={{ textAlign: 'right' }}>You</span>
                    <div className="ai-demo-bubble ai-demo-bubble-user">
                      verbal. but we have whatsapp messages where he agreed to the 50/50 split
                    </div>
                  </div>
                  {/* Turn 3 — spots the hole + cites Nigerian law */}
                  <div className="ai-demo-msg">
                    <span className="ai-demo-msg-sender">Pandas AI</span>
                    <div className="ai-demo-bubble ai-demo-bubble-ai">
                      <span className="ai-demo-highlight">WhatsApp messages are admissible evidence under Nigerian law</span> — that helps.
                      One thing to flag: a verbal partnership with no written terms weakens your position if he disputes the percentage.
                      Do you have a message where he specifically confirms your share of this particular job?{' '}
                      <span className="ai-demo-highlight">That single message will be the most important piece of evidence in your case.</span>
                    </div>
                  </div>
                  <div className="ai-demo-msg" style={{ alignItems: 'flex-end' }}>
                    <span className="ai-demo-msg-sender" style={{ textAlign: 'right' }}>You</span>
                    <div className="ai-demo-bubble ai-demo-bubble-user">
                      yes I have it. also I think I sent him a notice already but I can't remember if I did it properly
                    </div>
                  </div>
                  {/* Turn 4 — catches mistake + reassuring tone */}
                  <div className="ai-demo-msg">
                    <span className="ai-demo-msg-sender">Pandas AI</span>
                    <div className="ai-demo-bubble ai-demo-bubble-ai">
                      That's important to clarify before we proceed.{' '}
                      <span className="ai-demo-highlight">If a prior notice wasn't properly served, it could affect our timeline.</span>{' '}
                      Can you check if you have a copy or a delivery record? I'll wait — getting this right is worth the extra minute.
                    </div>
                  </div>
                </div>

                {/* Annotations panel */}
                <div className="ai-demo-annotations">
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 8px' }}>
                    What the AI is doing
                  </p>
                  <div className="ai-annotation">
                    <div className="ai-annotation-tag">Nigerian Law</div>
                    <div className="ai-annotation-text">Cites Cybercrimes Act 2015 — electronic records including WhatsApp are court-admissible</div>
                  </div>
                  <div className="ai-annotation">
                    <div className="ai-annotation-tag">Case Analysis</div>
                    <div className="ai-annotation-text">Flags the verbal-only partnership as a structural weak point before drafting begins</div>
                  </div>
                  <div className="ai-annotation">
                    <div className="ai-annotation-tag">Evidence Prioritisation</div>
                    <div className="ai-annotation-text">Identifies the single most important piece of evidence and explains why</div>
                  </div>
                  <div className="ai-annotation">
                    <div className="ai-annotation-tag">Tone · Reassuring</div>
                    <div className="ai-annotation-text">Detects uncertainty in "I can't remember if I did it properly" — slows down, reassures before correcting</div>
                  </div>
                  <div className="ai-annotation">
                    <div className="ai-annotation-tag">Mistake Caught</div>
                    <div className="ai-annotation-text">Catches the prior notice issue before it becomes a problem at court</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ OTHER SERVICES ══ */}
      <section className="section" id="services" aria-label="Other services">
        <div className="container">
          <Reveal>
            <div className="section-header">
              <span className="label-mono">All Services</span>
              <h2>More ways we can help</h2>
              <p>Debt recovery is our flagship — here's what else is live and what's coming.</p>
            </div>
          </Reveal>

          {/* Available for Testing */}
          <Reveal delay={80}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span className="label-mono">Available for Testing</span>
              <span style={{
                background: 'rgba(245,166,35,0.12)', color: 'var(--accent)',
                border: '1px solid rgba(245,166,35,0.25)',
                borderRadius: 'var(--radius-pill)', padding: '3px 10px',
                fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 600,
              }}>BETA</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 48 }}>
              {TESTING_SERVICES.map((svc, i) => (
                <Reveal key={svc.id} delay={i * 70}>
                  <div
                    className="card card-interactive"
                    style={{ position: 'relative', overflow: 'hidden', padding: '24px 26px', cursor: 'pointer' }}
                    onClick={() => onOpenAgent(svc.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenAgent(svc.id) }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Start ${svc.name}`}
                  >
                    {/* Top colour bar */}
                    <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: svc.color }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'var(--bg-2)', border: '1px solid var(--border-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: svc.color,
                      }}>
                        {svc.icon}
                      </div>
                      <span style={{
                        background: 'rgba(245,166,35,0.1)', color: 'var(--accent)',
                        border: '1px solid rgba(245,166,35,0.2)',
                        borderRadius: 4, padding: '2px 7px',
                        fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 600,
                      }}>BETA</span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {svc.shortName}
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8, color: 'var(--text-1)' }}>
                      {svc.name}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 16 }}>
                      {svc.description}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{svc.price}</span>
                      <span style={{ color: svc.color, fontSize: 13, fontWeight: 600 }}>Try it →</span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>

          {/* Coming Soon */}
          <Reveal delay={120}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span className="label-mono">Coming Soon</span>
              <span style={{
                background: 'var(--bg-2)', color: 'var(--text-3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-pill)', padding: '3px 10px',
                fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 600,
              }}>SOON</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {COMING_SOON_SERVICES.map((svc, i) => {
                const ns    = notifyState[svc.id] || 'idle'
                const email = notifyEmails[svc.id] || ''
                return (
                  <Reveal key={svc.id} delay={i * 60}>
                    <div style={{
                      background: 'var(--bg-1)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '24px 26px',
                      position: 'relative', overflow: 'hidden',
                      opacity: 0.7,
                    }}>
                      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: svc.color, opacity: 0.5 }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: 'var(--bg-2)', border: '1px solid var(--border-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--text-3)',
                        }}>
                          {svc.icon}
                        </div>
                        <span style={{
                          background: 'var(--bg-2)', color: 'var(--text-3)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 4, padding: '2px 7px',
                          fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                        }}>SOON</span>
                      </div>

                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8, color: 'var(--text-2)' }}>
                        {svc.name}
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.65, marginBottom: 16 }}>
                        {svc.description}
                      </p>

                      {/* Notify me flow */}
                      {ns === 'done' ? (
                        <div style={{ fontSize: 13, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle size={14} strokeWidth={2} />
                          We'll let you know when it's live.
                        </div>
                      ) : ns === 'open' || ns === 'submitting' ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="email"
                            className="input"
                            placeholder="your@email.com"
                            value={email}
                            autoFocus
                            onChange={e => setNotifyEmails(s => ({ ...s, [svc.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleNotifySubmit(svc.id, svc.name) }}
                            style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
                            aria-label={`Email to be notified about ${svc.name}`}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={!email || ns === 'submitting'}
                            onClick={() => handleNotifySubmit(svc.id, svc.name)}
                          >
                            {ns === 'submitting' ? '…' : 'Notify me'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          style={{
                            background: 'none', border: '1px solid var(--border-subtle)',
                            borderRadius: 8, padding: '8px 14px',
                            fontSize: 13, color: 'var(--text-2)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                            transition: 'border-color var(--anim-fast), color var(--anim-fast)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-focus)'; e.currentTarget.style.color = 'var(--text-1)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-2)' }}
                          onClick={() => setNotifyState(s => ({ ...s, [svc.id]: 'open' }))}
                        >
                          <Bell size={13} strokeWidth={1.5} />
                          Notify me when live
                        </button>
                      )}
                    </div>
                  </Reveal>
                )
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FEATURES BENTO ══ */}
      <section className="section" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} aria-label="Features">
        <div className="container">
          <Reveal>
            <div className="section-header">
              <span className="label-mono">Why Pandas LP</span>
              <h2>Everything a law firm does.<br />None of the friction.</h2>
            </div>
          </Reveal>

          <div className="bento-grid">
            {/* Hero card — spans 2 cols */}
            <Reveal delay={0}>
              <div className="bento-card bento-card-hero card-gradient" style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <div className="bento-icon"><Sparkles size={20} strokeWidth={1.5} /></div>
                  <h3 className="bento-title" style={{ fontSize: 22 }}>AI Legal Interview</h3>
                  <p className="bento-body">No forms. No jargon. Just answer questions in plain English — our AI handles the legal translation. Upload a document and it reads it so you don't have to explain it.</p>
                </div>
                <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['WhatsApp messages accepted', 'PDF invoices analysed', 'No legal knowledge needed'].map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                      <CheckCircle size={14} color="var(--secondary)" strokeWidth={2} />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {[
              { icon: <Scale size={18} strokeWidth={1.5} />,     title: 'Court-Ready Documents',    body: 'Demand letters on firm letterhead, drafted in minutes. Every document cites the correct Nigerian statute.' },
              { icon: <Clock size={18} strokeWidth={1.5} />,     title: 'Automated Follow-Up',      body: 'Day 0, Day 3, Day 7 — escalating pressure on the debtor, zero effort from you.' },
              { icon: <TrendingUp size={18} strokeWidth={1.5} />,title: 'Transparent Pricing',      body: 'Know exactly what you\'ll pay before you start. No retainers, no surprise bills.' },
              { icon: <Users size={18} strokeWidth={1.5} />,     title: 'Real Lawyers',             body: 'AI drafts, humans review. Licensed practitioners file and appear in court on your behalf.' },
              { icon: <Shield size={18} strokeWidth={1.5} />,    title: 'Bank-Grade Security',      body: 'Supabase row-level encryption. Only you and your assigned lawyer can see your case.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={(i + 1) * 60}>
                <div className="bento-card">
                  <div className="bento-icon">{f.icon}</div>
                  <h3 className="bento-title">{f.title}</h3>
                  <p className="bento-body">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRICING CALCULATOR ══ */}
      <section className="section" id="pricing" aria-label="Pricing calculator">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <span className="label-mono">Pricing</span>
              <h2>Know the cost before you start</h2>
              <p>Enter the amount you're owed and see an instant breakdown — no surprises.</p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="pricing-calc">
              <label className="field-label" htmlFor="calc-amount">
                How much are you owed?
              </label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">₦</span>
                <input
                  id="calc-amount"
                  type="text"
                  inputMode="numeric"
                  className="pricing-amount-input"
                  placeholder="0"
                  value={amount ? parseInt(amount).toLocaleString('en-NG') : ''}
                  onChange={handleAmountInput}
                  aria-label="Amount owed in Naira"
                />
              </div>

              <div className="pricing-breakdown">
                <div className="pricing-row">
                  <span className="pricing-row-label">Demand letter (self-serve PDF)</span>
                  <span className="pricing-row-value">{formatNaira(DEMAND_FEE)}</span>
                </div>
                <div className="pricing-row">
                  <span className="pricing-row-label">Follow-up emails (Day 3 + Day 7)</span>
                  <span className="pricing-row-value" style={{ color: 'var(--secondary)' }}>Included</span>
                </div>
                <div className="pricing-row">
                  <span className="pricing-row-label">Pandas LP serves the letter</span>
                  <span className="pricing-row-value">+₦15,000</span>
                </div>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                <div className="pricing-row pricing-row-total">
                  <span className="pricing-row-label">Total to get started</span>
                  <span className="pricing-row-value">{formatNaira(DEMAND_FEE)}</span>
                </div>
                <div className="pricing-savings">
                  <ArrowUpRight size={14} />
                  Save approx. {formatNaira(savings)} vs. a traditional lawyer
                </div>
              </div>

              <p className="pricing-disclaimer">
                Court filing fees apply only if your case escalates beyond the demand letter stage.
                The exact amount is quoted inside your dashboard before you pay — based on your claim amount and court jurisdiction.
              </p>

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 24, width: '100%', fontSize: 16, padding: '15px 24px' }}
                onClick={() => onOpenAgent('small-claims')}
              >
                Start for ₦{DEMAND_FEE.toLocaleString('en-NG')} →
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ COMPARISON TABLE ══ */}
      <section className="section" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} aria-label="Comparison">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <span className="label-mono">Compare</span>
              <h2>The fastest path to getting paid</h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div style={{ overflowX: 'auto', marginTop: 56 }}>
              <table className="comparison-table" role="table" aria-label="Service comparison">
                <thead>
                  <tr>
                    <th style={{ width: '28%', background: 'var(--bg-0)' }}></th>
                    <th className="comparison-col-pandas" style={{ textAlign: 'center' }}>Pandas LP</th>
                    <th style={{ textAlign: 'center', background: 'var(--bg-0)' }}>Traditional Lawyer</th>
                    <th style={{ textAlign: 'center', background: 'var(--bg-0)' }}>Do It Yourself</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map(row => {
                    const isPandas = (v) => v.startsWith('✓')
                    const isCross  = (v) => v.startsWith('✗')
                    const cell = (v) => (
                      <span style={{ color: isPandas(v) ? 'var(--secondary)' : isCross(v) ? 'var(--danger)' : 'var(--text-2)' }}>
                        {v}
                      </span>
                    )
                    return (
                      <tr key={row.label}>
                        <td style={{ fontWeight: 500, color: 'var(--text-2)' }}>{row.label}</td>
                        <td className="comparison-col-pandas" style={{ textAlign: 'center', fontWeight: 600 }}>{cell(row.pandas)}</td>
                        <td style={{ textAlign: 'center' }}>{cell(row.trad)}</td>
                        <td style={{ textAlign: 'center' }}>{cell(row.diy)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FOUNDING CLIENTS ══ */}
      <section className="section" aria-label="Founding clients">
        <div className="container">
          <Reveal>
            <div style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--border-subtle)',
              borderTop: '3px solid var(--accent)',
              borderRadius: 'var(--radius-lg)',
              padding: 'clamp(40px,6vw,72px)',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Background glow */}
              <div aria-hidden="true" style={{
                position: 'absolute', top: '-60%', left: '50%', transform: 'translateX(-50%)',
                width: 500, height: 300,
                background: 'radial-gradient(circle, rgba(245,166,35,0.07) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              <span className="label-mono" style={{ color: 'var(--accent)' }}>Founding Access</span>

              <h2 style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 'clamp(28px, 4vw, 48px)',
                letterSpacing: '-0.03em', lineHeight: 1.08,
                marginTop: 12, marginBottom: 16, color: 'var(--text-1)',
              }}>
                Be part of what's<br />changing Nigerian law.
              </h2>

              <p style={{
                color: 'var(--text-2)', fontSize: 17, lineHeight: 1.75,
                maxWidth: 560, margin: '0 auto 40px',
              }}>
                Pandas LP is new — and that's the point. For too long, recovering money
                in Nigeria meant weeks of waiting, ₦50,000 in lawyer fees, and no guarantee.
                We're building the alternative. You get to use it first.
              </p>

              {/* Three honest value props */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16, marginBottom: 40,
                textAlign: 'left',
              }}>
                {[
                  { icon: <Zap size={18} strokeWidth={1.5} />,   title: 'First mover',       body: 'AI-powered debt recovery doesn\'t exist at scale in Nigeria yet. You\'re early.' },
                  { icon: <Scale size={18} strokeWidth={1.5} />,  title: 'Real lawyers',       body: 'CAC-registered firm. Every document reviewed. Every filing handled by a licensed practitioner.' },
                  { icon: <Shield size={18} strokeWidth={1.5} />, title: 'Your case, your data', body: 'Encrypted. Private. Only you and your assigned lawyer can see your case.' },
                ].map(item => (
                  <div key={item.title} style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '20px 18px',
                  }}>
                    <div style={{ color: 'var(--accent)', marginBottom: 10 }}>{item.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', marginBottom: 6 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{item.body}</div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => onOpenAgent('small-claims')}
                style={{ minWidth: 240 }}
              >
                Start your first case →
              </button>

              <p style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
                Free preview · No commitment until you pay
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="section" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)' }} aria-label="FAQ">
        <div className="container" style={{ maxWidth: 760 }}>
          <Reveal>
            <div className="section-header center">
              <span className="label-mono">FAQ</span>
              <h2>Questions answered</h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div role="tablist" aria-label="FAQ categories" className="faq-tabs">
              {FAQ_TABS.map(tab => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={faqTab === tab}
                  className={`faq-tab${faqTab === tab ? ' active' : ''}`}
                  onClick={() => { setFaqTab(tab); setOpenFaq(null); }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="faq-list" role="tabpanel">
              {(FAQ_DATA[faqTab] || []).map((item, i) => {
                const id = `faq-${i}`
                const isOpen = openFaq === id
                return (
                  <div key={id} className={`faq-item${isOpen ? ' open' : ''}`}>
                    <button
                      type="button"
                      className="faq-trigger"
                      aria-expanded={isOpen}
                      aria-controls={`${id}-body`}
                      onClick={() => setOpenFaq(isOpen ? null : id)}
                    >
                      <span className="faq-question">{item.q}</span>
                      <ChevronDown size={18} strokeWidth={2} className="faq-chevron" aria-hidden="true" />
                    </button>
                    <div
                      id={`${id}-body`}
                      className="faq-body"
                      role="region"
                      aria-label={item.q}
                    >
                      <p className="faq-answer">{item.a}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ BOTTOM CTA ══ */}
      <section className="section" aria-label="Get started">
        <div className="container" style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <Reveal>
            <span className="label-mono">Ready to start?</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10, marginBottom: 16, lineHeight: 1.1 }}>
              Let's get your money back.
            </h2>
            <p style={{ color: 'var(--text-2)', fontSize: 17, lineHeight: 1.7, marginBottom: 36 }}>
              It takes under 10 minutes. AI does the heavy lifting,<br />real lawyers take it from there.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => onOpenAgent('small-claims')}>
                Recover your money →
              </button>
              <button type="button" className="btn btn-outline btn-lg" onClick={onStartLawyerConsult}>
                Speak to a lawyer
              </button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
