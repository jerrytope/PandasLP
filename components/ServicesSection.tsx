'use client'

import { AGENTS, type AgentId } from '@/lib/agents'
import Reveal from './Reveal'

const TESTING_AGENTS: AgentId[] = ['judgment-enforcement', 'lawyer-consultation']
const COMING_SOON_AGENTS: AgentId[] = ['recovery-of-premises', 'contracts', 'cac-registration']

interface ServicesSectionProps {
  onOpenAgent: (agentId: AgentId) => void
}

export default function ServicesSection({ onOpenAgent }: ServicesSectionProps) {
  const main = AGENTS['small-claims']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>

      {/* ── Featured service ── */}
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span className="label-mono">Our Core Service</span>
          <h2 style={{ marginTop: 8 }}>Recover what's owed to you</h2>
        </div>

        <div
          className="card card-gradient card-interactive"
          onClick={() => onOpenAgent('small-claims')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenAgent('small-claims') }}
          aria-label="Start Small Claims Court Agent"
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: 'clamp(28px,4vw,48px) clamp(24px,5vw,56px)',
            borderColor: 'rgba(214, 187, 128, 0.35)',
          }}
        >
          {/* accent bar */}
          <span style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: 3,
            background: 'linear-gradient(90deg, #B8860B, #8B6508)',
          }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{
                  background: 'rgba(214, 187, 128, 0.15)', color: 'var(--accent)',
                  border: '1px solid rgba(214, 187, 128, 0.3)',
                  borderRadius: 4, padding: '3px 10px',
                  fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 600,
                }}>FLAGSHIP SERVICE</span>
              </div>

              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(22px,3vw,34px)',
                fontWeight: 700, letterSpacing: '-0.02em',
                margin: '0 0 12px',
              }}>{main.name}</h3>

              <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.7, margin: '0 0 28px', maxWidth: 480 }}>
                Someone owes you money and won't pay. We interview you, draft your Letter of Demand on firm letterhead, serve it on the debtor, and file your court claim if they ignore it: end-to-end.
              </p>

              {/* mini steps */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginBottom: 32 }}>
                {['Quick Interview', 'Letter Drafted & Served', '14-Day Deadline Tracked', 'Court Filing if Ignored'].map((step, i) => (
                  <span key={step} style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 11 }}>0{i+1}</span>
                    {step}
                  </span>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 15, padding: '12px 28px' }}
              >
                Start Your Claim →
              </button>
            </div>

            {/* pricing panel */}
            <div style={{
              flex: '0 0 auto',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '24px 28px',
              minWidth: 200,
            }}>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>PRICING</p>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>₦10,000</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Self-serve PDF + stamp</div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--gold)' }}>₦25,000</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Pandas LP serves the letter</div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── Available for Testing ── */}
      <Reveal delay={100}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span className="label-mono">Also Available</span>
            <span style={{
              background: 'rgba(214, 187, 128, 0.15)', color: 'var(--gold)',
              border: '1px solid rgba(214, 187, 128, 0.3)',
              borderRadius: 4, padding: '2px 8px',
              fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 600,
            }}>AVAILABLE FOR TESTING</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            These agents are live and functional. Try them out and let us know how they work.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
          {TESTING_AGENTS.map((id, i) => {
            const agent = AGENTS[id]
            return (
              <Reveal key={id} delay={i * 60}>
                <div
                  className="card card-gradient card-interactive"
                  onClick={() => onOpenAgent(id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenAgent(id) }}
                  style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden' }}
                >
                  <span style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', height: 2, background: agent.color,
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.shortName}</span>
                    <span style={{
                      background: 'rgba(214, 187, 128, 0.1)', color: 'var(--gold)',
                      border: '1px solid rgba(214, 187, 128, 0.25)',
                      borderRadius: 3, padding: '1px 6px',
                      fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
                    }}>BETA</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{agent.name}</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, margin: '0 0 14px' }}>{agent.description}</p>
                  <span style={{ color: agent.color, fontSize: 13, fontWeight: 600 }}>Try it →</span>
                </div>
              </Reveal>
            )
          })}
        </div>
      </Reveal>

      {/* ── Coming Soon ── */}
      <Reveal delay={160}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span className="label-mono">More Services</span>
            <span style={{
              background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4, padding: '2px 8px',
              fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 600,
            }}>COMING SOON</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Expanding our practice areas, these will go live shortly.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
          {COMING_SOON_AGENTS.map((id, i) => {
            const agent = AGENTS[id]
            return (
              <Reveal key={id} delay={i * 50}>
                <div
                  className="card"
                  style={{
                    padding: '20px 24px',
                    opacity: 0.45,
                    cursor: 'not-allowed',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 0, left: 0,
                    width: '100%', height: 2, background: agent.color, opacity: 0.5,
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{agent.shortName}</span>
                    <span style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 3, padding: '1px 6px',
                      fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', color: 'var(--text-muted)',
                    }}>SOON</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{agent.name}</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{agent.description}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </Reveal>

    </div>
  )
}
