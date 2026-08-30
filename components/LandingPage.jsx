'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  MessageSquare, FileText, Send, Scale, Shield, Clock,
  TrendingUp, ChevronDown, CheckCircle, ArrowUpRight,
  Sparkles, Users, Zap, Gavel, Building2, Briefcase,
  CalendarCheck, Bell, Brain, Eye, Heart
} from 'lucide-react'
import Reveal from './Reveal'
import HiwFlowLine from './HiwFlowLine'
import TypewriterHeadline from './TypewriterHeadline'
import OrbitVisual from './OrbitVisual'
import TypingBeat from './TypingBeat'
import SectionLabel from './SectionLabel'
import AgentCapabilitiesModal from './AgentCapabilitiesModal'
import { useCountUp } from '../lib/useCountUp'
import { formatNaira } from '../lib/formatNaira'
import { AGENTS } from '../lib/agents'
import { AGENT_CAPABILITIES } from '../lib/agentCapabilities'
import { getAgentPayment } from '../lib/agentServiceMap'

/* ── Services config ── */
// Display order for the "Meet Our AI Legal Agents" roster — real agents from lib/agents.ts,
// availability per lib/agentCapabilities.ts. Only Small Claims and Property Law are live/
// interactive from the homepage; the rest are Coming Soon (notify-me only) — see that file's
// `availability` field, the single source of truth this maps over.
const AGENT_ROSTER_ORDER = [
  'small-claims',
  'recovery-of-premises',
  'contracts',
  'cac-registration',
  'judgment-enforcement',
  'lawyer-consultation',
]

/* ── Trust badges marquee items ── */
const TRUST_BADGES = [
  { label: 'CAC BN 9646741' },
  { label: 'Same-Day Letters' },
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
    { q: 'Is Pandas LP a real law firm?', a: 'Yes. Pandas LP is a registered business with the Nigerian Corporate Affairs Commission (CAC BN 9646741). Our licensed lawyers review, serve, and file every document before it reaches the debtor or a court.' },
    { q: 'How quickly can I get started?', a: 'Most clients complete a short guided interview and receive a draft demand letter in under 10 minutes. From there, you\'ll review, pay, and Pandas LP serves the letter within 24 business hours.' },
    { q: 'Do I need to know anything about law?', a: 'Not at all. We ask you plain-English questions about who owes you, how much, and why. You answer in your own words, and we handle the legal language.' },
  ],
  'Pricing': [
    { q: 'How much does it cost?', a: 'A demand letter starts from ₦10,000 (self-serve PDF). If you want Pandas LP to serve the letter on the debtor on your behalf, that\'s ₦25,000. Court filing fees are additional and vary by court.' },
    { q: 'Are there any hidden fees?', a: 'No. You see the full breakdown before you pay, and nothing changes after. Court filing fees are set by the government and we quote them exactly.' },
    { q: 'How do I pay?', a: 'Securely via Paystack. We accept debit cards, credit cards, and bank transfers, all major Nigerian banks supported.' },
  ],
  'Legal Process': [
    { q: 'What happens after the demand letter is sent?', a: 'The debtor has 14 days to respond. You\'ll receive follow-up email updates at Day 7 and Day 14. If they ignore the letter, we escalate to court filing, no extra action needed from you.' },
    { q: 'Can you actually take them to court?', a: 'Yes. Pandas LP\'s lawyers can file your claim at the Lagos Small Claims Court (or relevant state court) and represent you. Judgment enforcement is also available if they win but still don\'t pay.' },
    { q: 'What types of debt can you recover?', a: 'Unpaid invoices, personal loans, service fees, contractor payments, salary arrears, rent deposits, and goods paid for but not delivered. If it\'s money owed and documentable, we can help.' },
  ],
  'Security': [
    { q: 'Is my information safe?', a: 'Yes. All case data is stored in Supabase with row-level security, meaning only you and your assigned lawyer can access your case. Your documents are never shared with third parties.' },
    { q: 'Who sees my case details?', a: 'Only you and the Pandas LP legal team assigned to your matter. Your case details are confidential and used only to prepare your legal documents.' },
  ],
}

/* ── Pricing calculator logic ── */
const DEMAND_FEE   = 10000
const LAWYER_EQUIV = 80000

/* ── Comparison rows ── */
const COMPARE = [
  { label: 'Time to start',       pandas: '10 minutes',           trad: '2-4 weeks',       diy: 'Weeks of research' },
  { label: 'Pricing',             pandas: '✓ Flat, upfront',      trad: 'Hourly retainer',  diy: '✗ Hidden mistakes' },
  { label: 'Legal expertise',     pandas: '✓ Licensed lawyers',   trad: '✓ Lawyers only',  diy: '✗ None' },
  { label: 'Automated follow-up', pandas: '✓ Day 0, 7, 14',       trad: 'Manual',          diy: 'You chase them' },
  { label: 'Court filing',        pandas: '✓ Handled by us',      trad: '✓ Handled',       diy: '✗ Figure it out' },
  { label: 'Available',           pandas: '✓ 24 / 7',             trad: 'Office hours',    diy: 'When you can' },
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
  const [amount, setAmount]       = useState('')
  const [openFaq, setOpenFaq]     = useState(null)
  const [faqTab, setFaqTab]       = useState('Getting Started')
  const [demandFeeCount, priceRowRef] = useCountUp(DEMAND_FEE, { duration: 1000, startDelay: 200 })

  // Notify me state: { [serviceId]: 'idle' | 'open' | 'submitting' | 'done' }
  const [notifyState, setNotifyState] = useState({})
  const [notifyEmails, setNotifyEmails] = useState({})
  const [capabilitiesAgentId, setCapabilitiesAgentId] = useState(null)

  async function handleNotifySubmit(serviceId, serviceName) {
    const email = notifyEmails[serviceId] || ''
    if (!email) return
    setNotifyState(s => ({ ...s, [serviceId]: 'submitting' }))
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ service: serviceName, email }),
      })
      setNotifyState(s => ({ ...s, [serviceId]: res.ok ? 'done' : 'error' }))
    } catch {
      setNotifyState(s => ({ ...s, [serviceId]: 'error' }))
    }
  }

  const hasAmount = amount.replace(/[^0-9]/g, '').length > 0
  const savings   = LAWYER_EQUIV - DEMAND_FEE

  function handleAmountInput(e) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    setAmount(raw)
  }

  return (
    <>
      {/* ══ HERO ══ */}
      <section className="hero" aria-label="Hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-glow-secondary" aria-hidden="true" />

        <div className="hero-grid container">
          {/* Left copy */}
          <div className="hero-copy">
            <div className="hero-eyebrow" style={{ animationDelay: '0s' }}>
              <span className="hero-eyebrow-rule" />
              AI-native legal services, Lagos
            </div>

            <h1 className="hero-headline">
              <TypewriterHeadline lines={['The fastest way to', 'get legal help in Nigeria.']} accentFromLine={1} />
            </h1>

            <p className="hero-sub" style={{ animation: 'fade-in-up 0.6s ease 1.4s both' }}>
              AI-native legal services: fast, effortless, and dependable. Describe your problem,
              upload your documents, and a specialist agent handles the first layer of work —
              a licensed lawyer reviews and delivers everything before it reaches you.
            </p>

            <div className="hero-actions" style={{ animation: 'fade-in-up 0.6s ease 1.6s both' }}>
              <a href="#services" className="btn btn-primary btn-lg">
                Explore Our AI Agents →
              </a>
              <button
                type="button"
                className="hero-link"
                onClick={() => onOpenAgent('small-claims')}
              >
                Get legal help now
              </button>
            </div>
          </div>

          <OrbitVisual />
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

      {/* ══ THE PANDAS MODEL ══ */}
      <section className="section hiw-section" id="how-it-works" aria-label="The Pandas Model">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <SectionLabel>The Pandas Model</SectionLabel>
              <h2>Law, rebuilt around AI.</h2>
              <p>AI speed. Lawyer accountability.</p>
            </div>
          </Reveal>

          <HiwFlowLine steps={4} />

          <div className="hiw-grid hiw-grid-4">
            {[
              {
                num: '01',
                icon: <MessageSquare size={22} strokeWidth={1.5} aria-hidden="true" />,
                title: 'Tell your AI agent what happened',
                body: 'Describe your problem in your own words and upload any documents you have. The right specialist agent — Small Claims, Property Law, and more coming — takes it from there.',
                detail: 'Structured intake, any time of day',
              },
              {
                num: '02',
                icon: <FileText size={22} strokeWidth={1.5} aria-hidden="true" />,
                title: 'AI does the first layer',
                body: 'Structured questions, document analysis, issue identification, and draft preparation — the work a paralegal or junior associate would normally spend hours on.',
                detail: 'Minutes, not weeks',
              },
              {
                num: '03',
                icon: <Send size={22} strokeWidth={1.5} aria-hidden="true" />,
                title: 'A lawyer steps in',
                body: 'When professional legal judgment, service, filing, or representation is required, a licensed Pandas LP lawyer reviews the work and takes responsibility for it — before anything reaches a client, debtor, or court.',
                detail: 'Human judgment, every time',
              },
              {
                num: '04',
                icon: <Scale size={22} strokeWidth={1.5} aria-hidden="true" />,
                title: 'Move the matter forward',
                body: 'Documents get served, filings get made, deadlines get tracked automatically. You get real progress, not just a drafted PDF.',
                detail: 'Tracked to resolution',
              },
            ].map((step, i) => (
              <Reveal key={step.num} delay={i * 90}>
                <div className="hiw-step-card">
                  <div className="hiw-step-num">{step.num}</div>
                  <div className="hiw-icon">{step.icon}</div>
                  <h3 className="hiw-step-title">{step.title}</h3>
                  <p className="hiw-step-body">{step.body}</p>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.05em', position: 'relative', zIndex: 1, display: 'inline-block' }}>
                    {step.detail}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TRUST SECTION ══ */}
      <section className="section" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} aria-label="How AI and lawyers share the work">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <SectionLabel>AI-powered doesn't mean lawyer-free</SectionLabel>
              <h2>We didn't build AI to replace lawyers.<br />We built it to redesign how legal work gets done.</h2>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 48 }}>
            <Reveal delay={60}>
              <div className="card glass-panel" style={{ padding: '28px 30px', height: '100%' }}>
                <div className="label-mono" style={{ color: 'var(--secondary)', marginBottom: 14 }}>What AI handles</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['Legal intake', 'Document analysis', 'Structured questioning', 'Issue identification', 'Draft preparation', 'Workflow automation', '24/7 availability'].map((item) => (
                    <li key={item} style={{ fontSize: 14.5, color: 'var(--text-1)', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--secondary)', flexShrink: 0 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="card glass-panel" style={{ padding: '28px 30px', height: '100%', borderColor: 'var(--accent-glow)' }}>
                <div className="label-mono" style={{ color: 'var(--accent)', marginBottom: 14 }}>What Pandas LP lawyers handle</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['Legal review', 'Professional judgment', 'Filing', 'Service', 'Representation', 'Escalation', 'Human legal responsibility'].map((item) => (
                    <li key={item} style={{ fontSize: 14.5, color: 'var(--text-1)', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ THE INTERVIEW ══ */}
      <section className="section ai-intel-section" id="the-ai" aria-label="How the interview works">
        <div className="container">
          <Reveal>
            <div className="section-header">
              <h2>Not a form.<br />A proper legal interview.</h2>
              <p style={{ maxWidth: 560 }}>
                Every case follows Nigerian legal procedure, debt recovery case law,
                and the exact questions a senior partner asks in a first consultation, minus the billable hours.
              </p>
            </div>
          </Reveal>

          {/* 4 feature tiles */}
          <div className="ai-features-grid">
            {[
              {
                icon: <Brain size={20} strokeWidth={1.5} aria-hidden="true" />,
                accentVar: '--accent',
                tag: 'Structured Intake',
                title: 'Asks the right questions in the right order',
                body: 'The interview follows the same intake logic a senior litigator uses: debtor identity, relationship to the debt, contract terms, payment history, evidence quality, limitation period. Every time, in the right sequence, nothing skipped.',
              },
              {
                icon: <Eye size={20} strokeWidth={1.5} aria-hidden="true" />,
                accentVar: '--secondary',
                tag: 'Case Analysis',
                title: 'Spots the holes before the judge does',
                body: 'If your dates don\'t add up, it flags it. If your only evidence is a verbal promise, it tells you that\'s a weak case and explains why. It asks follow-up questions until your case is tight enough to put in front of a court.',
              },
              {
                icon: <Heart size={20} strokeWidth={1.5} aria-hidden="true" />,
                accentVar: '--info',
                tag: 'Reads the Room',
                title: 'Meets you where you\'re at',
                body: 'A client typing in short, angry fragments is probably at their limit. Someone who writes "I don\'t know if this will work" needs reassurance before they need information. The interview adjusts to it: calmer when you\'re stressed, more direct when you\'re ready to move.',
              },
              {
                icon: <Scale size={20} strokeWidth={1.5} aria-hidden="true" />,
                accentVar: '--accent',
                tag: 'Nigerian Law',
                title: 'Grounded in real Nigerian legal framework',
                body: 'The system is built on the Limitation Law of Lagos State, CAMA 2020, the Small Claims Court Civil Procedure Rules, and Nigerian digital evidence standards, not generic templates. It knows which court to file in, what threshold requires what evidence, and what the debtor\'s defences are likely to be.',
              },
            ].map((f, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="ai-feature-card">
                  <div
                    className="ai-feature-icon"
                    style={{
                      background: `color-mix(in srgb, var(${f.accentVar}) 12%, transparent)`,
                      color: `var(${f.accentVar})`,
                    }}
                  >
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
                <span className="ai-demo-label">Sample interview: Small Claims Agent</span>
              </div>
              <div className="ai-demo-body">
                <div className="ai-demo-chat">
                  {/* Opening beat — the AI is "composing" before the first message lands */}
                  <TypingBeat />

                  {/* Turn 1 */}
                  <Reveal delay={500}>
                    <div className="ai-demo-msg">
                      <span className="ai-demo-msg-sender">Pandas LP</span>
                      <div className="ai-demo-bubble ai-demo-bubble-ai">
                        Who owes you money, and what was it for?
                      </div>
                    </div>
                  </Reveal>
                  <Reveal delay={750}>
                    <div className="ai-demo-msg" style={{ alignItems: 'flex-end' }}>
                      <span className="ai-demo-msg-sender" style={{ textAlign: 'right' }}>You</span>
                      <div className="ai-demo-bubble ai-demo-bubble-user">
                        my business partner. we did a construction job together and he took the client payment but never paid my share. about ₦1.2 million
                      </div>
                    </div>
                  </Reveal>
                  {/* Turn 2 — legal precision */}
                  <Reveal delay={1000}>
                    <div className="ai-demo-msg">
                      <span className="ai-demo-msg-sender">Pandas LP</span>
                      <div className="ai-demo-bubble ai-demo-bubble-ai">
                        Understood. Do you have a written partnership or profit-sharing agreement, or was this verbal?
                      </div>
                    </div>
                  </Reveal>
                  <Reveal delay={1250}>
                    <div className="ai-demo-msg" style={{ alignItems: 'flex-end' }}>
                      <span className="ai-demo-msg-sender" style={{ textAlign: 'right' }}>You</span>
                      <div className="ai-demo-bubble ai-demo-bubble-user">
                        verbal. but we have whatsapp messages where he agreed to the 50/50 split
                      </div>
                    </div>
                  </Reveal>
                  {/* Turn 3 — spots the hole + cites Nigerian law */}
                  <Reveal delay={1500}>
                    <div className="ai-demo-msg">
                      <span className="ai-demo-msg-sender">Pandas LP</span>
                      <div className="ai-demo-bubble ai-demo-bubble-ai">
                        <span className="ai-demo-highlight">WhatsApp messages are admissible evidence under Nigerian law</span>, that helps.
                        One thing to flag: a verbal partnership with no written terms weakens your position if he disputes the percentage.
                        Do you have a message where he specifically confirms your share of this particular job?{' '}
                        <span className="ai-demo-highlight">That single message will be the most important piece of evidence in your case.</span>
                      </div>
                    </div>
                  </Reveal>
                  <Reveal delay={1850}>
                    <div className="ai-demo-msg" style={{ alignItems: 'flex-end' }}>
                      <span className="ai-demo-msg-sender" style={{ textAlign: 'right' }}>You</span>
                      <div className="ai-demo-bubble ai-demo-bubble-user">
                        yes I have it. also I think I sent him a notice already but I can't remember if I did it properly
                      </div>
                    </div>
                  </Reveal>
                  {/* Turn 4 — catches mistake + reassuring tone */}
                  <Reveal delay={2100}>
                    <div className="ai-demo-msg">
                      <span className="ai-demo-msg-sender">Pandas LP</span>
                      <div className="ai-demo-bubble ai-demo-bubble-ai">
                        That's important to clarify before we proceed.{' '}
                        <span className="ai-demo-highlight">If a prior notice wasn't properly served, it could affect our timeline.</span>{' '}
                        Can you check if you have a copy or a delivery record? I'll wait, getting this right is worth the extra minute.
                      </div>
                    </div>
                  </Reveal>
                </div>

                {/* Annotations panel */}
                <Reveal delay={2300} className="ai-demo-annotations">
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 8px' }}>
                    What this catches
                  </p>
                  <div className="ai-annotation">
                    <div className="ai-annotation-tag">Case Analysis</div>
                    <div className="ai-annotation-text">Flags the verbal-only partnership as a structural weak point before drafting begins</div>
                  </div>
                  <div className="ai-annotation">
                    <div className="ai-annotation-tag">Mistake Caught</div>
                    <div className="ai-annotation-text">Catches the prior notice issue before it becomes a problem at court</div>
                  </div>
                </Reveal>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ MEET OUR AI LEGAL AGENTS ══ */}
      <section className="section" id="services" aria-label="Our AI legal agents">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <SectionLabel>Pandas Legal AI</SectionLabel>
              <h2>Meet Our AI Legal Agents</h2>
              <p>Each agent is a specialist, guided by the same licensed lawyers who review everything it drafts.</p>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 18, marginTop: 48 }}>
            {AGENT_ROSTER_ORDER.map((id, i) => {
              const agent = AGENTS[id]
              const caps = AGENT_CAPABILITIES[id]
              const payment = getAgentPayment(id)
              const ns = notifyState[id] || 'idle'
              const email = notifyEmails[id] || ''
              const isOpen = caps.availability !== 'soon'

              return (
                <Reveal key={id} delay={i * 60}>
                  <div className="card glass-panel card-gradient" style={{ position: 'relative', overflow: 'hidden', padding: '24px 26px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 11,
                        background: 'var(--bg-2)', border: `1px solid ${agent.color}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
                      }}>
                        {agent.icon}
                      </div>
                      <span className={`badge badge-sm ${caps.availability === 'live' ? 'badge-accent' : 'badge-muted'}`}>
                        {caps.availability === 'live' ? '🟢 LIVE' : '🔒 Coming Soon'}
                      </span>
                    </div>

                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8, color: 'var(--text-1)' }}>
                      {agent.name}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, marginBottom: 16, flex: 1 }}>
                      {agent.description}
                    </p>

                    <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                      {caps.highlights[0]}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
                        {payment.amount ? formatNaira(payment.amount) : 'Ask us'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCapabilitiesAgentId(id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                      >
                        Check Capabilities →
                      </button>
                    </div>

                    {isOpen ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-block"
                        onClick={() => onOpenAgent(id)}
                      >
                        Engage Agent
                      </button>
                    ) : ns === 'done' ? (
                      <div style={{ fontSize: 13, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={14} strokeWidth={2} aria-hidden="true" />
                        We'll let you know when it's live.
                      </div>
                    ) : ns === 'open' || ns === 'submitting' || ns === 'error' ? (
                      <div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            type="email"
                            className="input"
                            placeholder="your@email.com"
                            value={email}
                            autoFocus
                            onChange={e => setNotifyEmails(s => ({ ...s, [id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleNotifySubmit(id, agent.name) }}
                            style={{ flex: 1, fontSize: 13, padding: '9px 12px' }}
                            aria-label={`Email to be notified about ${agent.name}`}
                          />
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={!email || ns === 'submitting'}
                            onClick={() => handleNotifySubmit(id, agent.name)}
                          >
                            {ns === 'submitting' ? '…' : ns === 'error' ? 'Retry' : 'Notify'}
                          </button>
                        </div>
                        {ns === 'error' && (
                          <p style={{ color: 'var(--danger)', fontSize: 12, margin: '6px 0 0' }}>
                            Something went wrong. Please try again.
                          </p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="notify-btn"
                        onClick={() => setNotifyState(s => ({ ...s, [id]: 'open' }))}
                      >
                        <Bell size={13} strokeWidth={1.5} aria-hidden="true" />
                        Notify me when live
                      </button>
                    )}
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {capabilitiesAgentId && (
        <AgentCapabilitiesModal
          agent={AGENTS[capabilitiesAgentId]}
          onClose={() => setCapabilitiesAgentId(null)}
          onEngage={() => {
            const id = capabilitiesAgentId
            setCapabilitiesAgentId(null)
            onOpenAgent(id)
          }}
        />
      )}

      {/* ══ SERVICE UNIVERSE ══ */}
      <section className="section" aria-label="The full range of legal matters Pandas can help with">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <SectionLabel>Beyond the two live agents</SectionLabel>
              <h2>Built for the legal problems Nigerians actually face</h2>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginTop: 48 }}>
            {[
              { category: 'Money & Disputes', items: ['Debt Recovery', 'Small Claims', 'Judgment Enforcement'] },
              { category: 'Property', items: ['Tenancy', 'Recovery of Premises', 'Property Documents', 'Property Disputes'] },
              { category: 'Business', items: ['Contracts', 'NDAs', 'Partnership Agreements', 'CAC Registration', 'Business Operationalisation'] },
              { category: 'Legal Documents', items: ['Demand Letters', 'Notices', 'Contract Review', 'Legal Correspondence'] },
            ].map((group, i) => (
              <Reveal key={group.category} delay={i * 70}>
                <div className="card" style={{ padding: '22px 24px', height: '100%' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--accent)', marginBottom: 14 }}>
                    {group.category}
                  </h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {group.items.map((item) => (
                      <li key={item} style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{item}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={280}>
            <p style={{ textAlign: 'center', marginTop: 36, color: 'var(--text-3)', fontSize: 13.5, fontFamily: 'var(--font-mono)' }}>
              More legal agents are coming.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══ FEATURES BENTO ══ */}
      <section className="section" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} aria-label="Features">
        <div className="container">
          <Reveal>
            <div className="section-header">
              <h2>Everything a law firm does.<br />None of the friction.</h2>
            </div>
          </Reveal>

          <div className="bento-grid">
            {/* Hero card — spans 2 cols */}
            <Reveal delay={0}>
              <div className="bento-card bento-card-hero card-gradient" style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <div className="bento-icon"><Sparkles size={20} strokeWidth={1.5} aria-hidden="true" /></div>
                  <h3 className="bento-title" style={{ fontSize: 22 }}>Guided Legal Interview</h3>
                  <p className="bento-body">No forms. No jargon. Just answer questions in plain English, we handle the legal translation. Upload a document and we read it so you don't have to explain it.</p>
                </div>
                <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['WhatsApp messages accepted', 'PDF invoices analysed', 'No legal knowledge needed'].map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                      <CheckCircle size={14} color="var(--secondary)" strokeWidth={2} aria-hidden="true" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {[
              { icon: <Scale size={18} strokeWidth={1.5} aria-hidden="true" />,     title: 'Court-Ready Documents',    body: 'Demand letters on firm letterhead, drafted in minutes. Every document cites the correct Nigerian statute.' },
              { icon: <Clock size={18} strokeWidth={1.5} aria-hidden="true" />,     title: 'Automated Follow-Up',      body: 'Day 0, Day 7, Day 14: escalating pressure on the debtor, zero effort from you.' },
              { icon: <TrendingUp size={18} strokeWidth={1.5} aria-hidden="true" />,title: 'Transparent Pricing',      body: 'Know exactly what you\'ll pay before you start. No retainers, no surprise bills.' },
              { icon: <Users size={18} strokeWidth={1.5} aria-hidden="true" />,     title: 'Real Lawyers',             body: 'Every document is reviewed by our team. Licensed practitioners file and appear in court on your behalf.' },
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
              <SectionLabel>Pricing</SectionLabel>
              <h2>Know the cost before you start</h2>
              <p>Enter the amount you're owed and see an instant breakdown, no surprises.</p>
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
                  <span className="pricing-row-label">Demand letter, drafted & reviewed</span>
                  <span className="pricing-row-value">{formatNaira(DEMAND_FEE)}</span>
                </div>
                <div className="pricing-row">
                  <span className="pricing-row-label">Follow-up emails (Day 7 + Day 14)</span>
                  <span className="pricing-row-value" style={{ color: 'var(--secondary)' }}>Included</span>
                </div>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                <div className="pricing-row pricing-row-total" ref={priceRowRef}>
                  <span className="pricing-row-label">Total to get started</span>
                  <span className="pricing-row-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatNaira(demandFeeCount)}
                  </span>
                </div>
                <div className="pricing-savings">
                  <ArrowUpRight size={14} aria-hidden="true" />
                  Save approx. {formatNaira(savings)} vs. a traditional lawyer
                </div>
                <div className="pricing-row" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border-subtle)' }}>
                  <span className="pricing-row-label" style={{ color: 'var(--text-muted)' }}>Optional: Pandas LP delivers it for you</span>
                  <span className="pricing-row-value" style={{ color: 'var(--text-muted)' }}>+₦15,000</span>
                </div>
              </div>

              <p className="pricing-disclaimer">
                Court filing fees apply only if your case escalates beyond the demand letter stage.
                The exact amount is quoted inside your dashboard before you pay, based on your claim amount and court jurisdiction.
              </p>

              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 24, width: '100%', fontSize: 16, padding: '15px 24px' }}
                onClick={() => onOpenAgent('small-claims')}
              >
                Start for {formatNaira(DEMAND_FEE)} →
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section className="section" id="agent-pricing" aria-label="Pricing by agent">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <SectionLabel>Pricing</SectionLabel>
              <h2>Transparent, per-agent pricing</h2>
              <p>No hourly billing, no surprise invoices. See exactly what you'll pay before you start.</p>
            </div>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginTop: 48 }}>
            {AGENT_ROSTER_ORDER.map((id, i) => {
              const agent = AGENTS[id]
              const caps = AGENT_CAPABILITIES[id]
              const payment = getAgentPayment(id)
              const isOpen = caps.availability !== 'soon'
              return (
                <Reveal key={id} delay={i * 60}>
                  <div className="card" style={{ padding: '24px 26px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, marginBottom: 6, color: 'var(--text-1)' }}>
                      {agent.name}
                    </h3>
                    <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16 }}>
                      {caps.highlights[0]}
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {caps.highlights.slice(0, 3).map((h) => (
                        <li key={h} style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', gap: 8 }}>
                          <CheckCircle size={13} strokeWidth={2} style={{ color: 'var(--secondary)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--accent)', marginBottom: 14 }}>
                      {payment.amount ? formatNaira(payment.amount) : 'Placeholder — ask us'}
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      disabled={!isOpen}
                      onClick={() => isOpen && onOpenAgent(id)}
                    >
                      {isOpen ? 'Get legal help →' : 'Coming soon'}
                    </button>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══ LAWYER ACCESS ══ */}
      <section className="section" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} aria-label="Speak to a lawyer">
        <div className="container">
          <Reveal>
            <div style={{
              maxWidth: 640, margin: '0 auto', textAlign: 'center',
              background: 'var(--bg-0)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)', padding: 'clamp(32px,5vw,56px)',
            }}>
              <SectionLabel>Lawyer Access</SectionLabel>
              <h2 style={{ margin: '10px 0 14px' }}>Sometimes you need a lawyer.</h2>
              <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
                Not every matter fits a template. When professional legal judgment is required, the AI
                workflow connects you directly to a real, licensed Pandas LP lawyer.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={onStartLawyerConsult}
              >
                Speak to a lawyer →
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ COMPARISON TABLE ══ */}
      <section className="section" aria-label="Comparison">
        <div className="container">
          <Reveal>
            <div className="section-header center">
              <SectionLabel>Pandas Legal AI vs. The Alternatives</SectionLabel>
              <h2>The fastest path to getting paid</h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div style={{ overflowX: 'auto', marginTop: 56 }}>
              <table className="comparison-table" role="table" aria-label="Service comparison">
                <thead>
                  <tr>
                    <th style={{ width: '28%', background: 'var(--bg-0)' }}></th>
                    <th className="comparison-col-pandas" style={{ textAlign: 'center' }}>Pandas Legal AI</th>
                    <th style={{ textAlign: 'center', background: 'var(--bg-0)' }}>Traditional Law Firm</th>
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
              <div className="founding-glow" aria-hidden="true" style={{
                position: 'absolute', top: '-60%', left: '50%', transform: 'translateX(-50%)',
                width: 500, height: 300,
                pointerEvents: 'none',
              }} />

              <SectionLabel>Founding Access</SectionLabel>

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
                Pandas LP is new, and that's the point. For too long, recovering money
                in Nigeria meant weeks of waiting, ₦50,000 in lawyer fees, and no guarantee.
                We're building the alternative. You get to use it first.
              </p>

              {/* Three honest value props — a divided row instead of boxed cards, so this
                  doesn't read as the same feature-grid pattern as the sections above it */}
              <div style={{
                display: 'flex', flexWrap: 'wrap',
                marginBottom: 40, textAlign: 'left',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                {[
                  { icon: <Zap size={18} strokeWidth={1.5} aria-hidden="true" />,   title: 'First mover',       body: 'Fast, affordable debt recovery doesn\'t exist at scale in Nigeria yet. You\'re early.' },
                  { icon: <Scale size={18} strokeWidth={1.5} aria-hidden="true" />,  title: 'Real lawyers',       body: 'CAC-registered firm. Every document reviewed. Every filing handled by a licensed practitioner.' },
                  { icon: <Shield size={18} strokeWidth={1.5} aria-hidden="true" />, title: 'Your case, your data', body: 'Encrypted. Private. Only you and your assigned lawyer can see your case.' },
                ].map((item, i) => (
                  <div key={item.title} style={{
                    flex: '1 1 220px',
                    padding: '22px 20px',
                    borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ color: 'var(--accent)', display: 'flex' }}>{item.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>{item.title}</span>
                    </div>
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

      {/* ══ REFERRAL / INVITE ══ */}
      <section className="section" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }} aria-label="Refer a friend">
        <div className="container">
          <Reveal>
            <div style={{
              maxWidth: 640, margin: '0 auto', textAlign: 'center',
              background: 'var(--bg-0)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)', padding: 'clamp(32px,5vw,56px)',
            }}>
              <SectionLabel>Refer a Friend</SectionLabel>
              <h2 style={{ margin: '10px 0 14px' }}>Know someone who needs this?</h2>
              <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
                Share your link with a friend or colleague. We track every referral —
                reward details are launching soon, but your invites count from day one.
              </p>

              {user ? (
                <div>
                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
                    background: 'var(--bg-1)', border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16,
                  }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-1)', overflowWrap: 'anywhere' }}>
                      {referralLink}
                    </code>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary" onClick={copyReferralLink}>
                      {referralCopied ? 'Copied!' : 'Copy Your Link'}
                    </button>
                    <a
                      className="btn"
                      href={`https://wa.me/?text=${encodeURIComponent(`Check out Pandas LP for fast, affordable legal help: ${referralLink}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Share on WhatsApp
                    </a>
                    <a
                      className="btn"
                      href={`mailto:?subject=${encodeURIComponent('Try Pandas LP')}&body=${encodeURIComponent(`I've been using Pandas LP for legal help — thought you'd find it useful: ${referralLink}`)}`}
                    >
                      Invite by Email
                    </a>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-primary btn-lg" onClick={onRequestAuth}>
                  Sign in to get your referral link →
                </button>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="section" style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--border-subtle)' }} aria-label="FAQ">
        <div className="container" style={{ maxWidth: 760 }}>
          <Reveal>
            <div className="section-header center">
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
      <section className="section" aria-label="Get started" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="bottom-cta-glow" aria-hidden="true" style={{
          position: 'absolute', bottom: '-40%', left: '50%', transform: 'translateX(-50%)',
          width: 520, height: 320,
          pointerEvents: 'none',
        }} />
        <div className="container" style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto', position: 'relative' }}>
          <Reveal>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,4vw,48px)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16, lineHeight: 1.1 }}>
              Let's get your money back.
            </h2>
            <p style={{ color: 'var(--text-2)', fontSize: 17, lineHeight: 1.7, marginBottom: 36 }}>
              It takes under 10 minutes. We do the heavy lifting,<br />real lawyers take it from there.
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
