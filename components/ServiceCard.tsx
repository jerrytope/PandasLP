'use client'

import { useState, type KeyboardEvent } from 'react'
import type { Agent } from '@/lib/agents'
import { LAWYER_CONSULT_FEE } from '@/lib/services'
import AgentChat from './AgentChat'
import styles from './ServiceCard.module.css'

interface ServiceCardProps {
  agent: Agent
  onContinue: () => void
  animationDelay?: string
}

export default function ServiceCard({ agent, onContinue, animationDelay }: ServiceCardProps) {
  const [open, setOpen] = useState(false)

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }

  const continueLabel = agent.id === 'lawyer-consultation' ? 'Continue to Booking →' : 'Continue to Document Intake →'

  return (
    <>
      <div
        className="card card-gradient card-interactive service-card fade-in"
        style={{ animationDelay }}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Start ${agent.name}`}
      >
        <span className={styles.accentBar} style={{ background: agent.color }} />
        <div className={styles.body}>
          <span className="service-tagline">{agent.shortName}</span>
          <span className="service-title">{agent.name}</span>
          <p className="service-description">{agent.description}</p>
          {agent.id === 'lawyer-consultation' && (
            <span className="service-price">Consultation fee: ₦{LAWYER_CONSULT_FEE.toLocaleString()}</span>
          )}
          <span className={styles.startLink} style={{ color: agent.color }}>
            Start now →
          </span>
        </div>
      </div>

      {open && (
        <AgentChat
          agent={agent}
          onClose={() => setOpen(false)}
          onContinue={() => {
            setOpen(false)
            onContinue()
          }}
          continueLabel={continueLabel}
        />
      )}
    </>
  )
}
