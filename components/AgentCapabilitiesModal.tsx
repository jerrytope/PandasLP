'use client'

import { useEffect, useRef } from 'react'
import { X, CheckCircle2, ShieldCheck } from 'lucide-react'
import type { Agent } from '@/lib/agents'
import { AGENT_CAPABILITIES } from '@/lib/agentCapabilities'
import { getAgentPayment } from '@/lib/agentServiceMap'
import { formatNaira } from '@/lib/formatNaira'
import { useFocusTrap } from '@/lib/useFocusTrap'

const AVAILABILITY_LABEL: Record<string, string> = {
  live: 'Live Now',
  testing: 'Available for Testing',
  soon: 'Coming Soon',
}

const AVAILABILITY_COLOR: Record<string, string> = {
  live: 'var(--secondary)',
  testing: 'var(--accent)',
  soon: 'var(--text-3)',
}

export default function AgentCapabilitiesModal({
  agent,
  onClose,
  onEngage,
}: {
  agent: Agent
  onClose: () => void
  onEngage: () => void
}) {
  const modalRef = useRef<HTMLDivElement>(null)
  useFocusTrap(modalRef, true)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const caps = AGENT_CAPABILITIES[agent.id]
  const payment = getAgentPayment(agent.id)
  const availability = caps?.availability ?? 'soon'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(2, 3, 6, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${agent.name} capabilities`}
        className="glass-panel"
        style={{
          width: '100%', maxWidth: 560,
          maxHeight: '85vh', overflowY: 'auto',
          padding: 'clamp(24px,4vw,40px)',
          position: 'relative',
          boxShadow: '0 40px 100px -30px rgba(0,0,0,0.6)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 18, right: 18,
            background: 'transparent', border: 'none', color: 'var(--text-2)',
            cursor: 'pointer', padding: 6,
          }}
        >
          <X size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--bg-2)', border: `1px solid ${agent.color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            {agent.icon}
          </div>
          <div>
            <div
              className="label-mono"
              style={{ color: AVAILABILITY_COLOR[availability], marginBottom: 2 }}
            >
              {AVAILABILITY_LABEL[availability]}
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>
              {agent.name}
            </h3>
          </div>
        </div>

        <p style={{ color: 'var(--text-2)', fontSize: 14.5, lineHeight: 1.7, margin: '14px 0 22px' }}>
          {agent.description}
        </p>

        <div className="label-mono" style={{ marginBottom: 10 }}>What it handles</div>
        <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {caps?.highlights.map((h) => (
            <li key={h} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--text-1)', lineHeight: 1.55 }}>
              <CheckCircle2 size={16} strokeWidth={1.5} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              {h}
            </li>
          ))}
        </ul>

        {caps?.differentiator && (
          <div style={{
            background: 'var(--bg-2)', border: '1px solid var(--border-subtle)',
            borderLeft: '3px solid var(--accent)', borderRadius: 8,
            padding: '14px 16px', fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.65,
            marginBottom: 24,
          }}>
            {caps.differentiator}
          </div>
        )}

        {caps?.safeguards && caps.safeguards.length > 0 && (
          <>
            <div className="label-mono" style={{ marginBottom: 10 }}>Safeguards</div>
            <ul style={{ listStyle: 'none', margin: '0 0 24px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {caps.safeguards.map((s) => (
                <li key={s} style={{ display: 'flex', gap: 10, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <ShieldCheck size={15} strokeWidth={1.5} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {payment.kind === 'lawyer' ? 'Consultation fee' : 'Document fee'}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
              {payment.amount ? formatNaira(payment.amount) : 'Ask us'}
            </div>
          </div>

          {availability === 'soon' ? (
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Not open to the public yet</span>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onEngage}>
              Engage this Agent →
            </button>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 20, lineHeight: 1.6 }}>
          A licensed Pandas LP lawyer reviews every document this agent drafts before it's sent to you.
        </p>
      </div>
    </div>
  )
}
