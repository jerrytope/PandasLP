'use client'

import type { KeyboardEvent } from 'react'
import type { Agent } from '@/lib/agents'
import { LAWYER_CONSULT_FEE } from '@/lib/services'
import styles from './ServiceCard.module.css'

interface ServiceCardProps {
  agent: Agent
  onOpen: () => void
}

export default function ServiceCard({ agent, onOpen }: ServiceCardProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      className="card card-gradient card-interactive service-card"
      onClick={onOpen}
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
  )
}
