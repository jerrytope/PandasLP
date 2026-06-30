import { AGENTS, type AgentId } from '@/lib/agents'
import ServiceCard from './ServiceCard'
import Reveal from './Reveal'

const AGENT_ORDER: AgentId[] = [
  'small-claims',
  'recovery-of-premises',
  'contracts',
  'cac-registration',
  'lawyer-consultation',
]

interface ServicesSectionProps {
  onOpenAgent: (agentId: AgentId) => void
}

export default function ServicesSection({ onOpenAgent }: ServicesSectionProps) {
  return (
    <>
      <Reveal>
        <div className="step-header" style={{ textAlign: 'center' }}>
          <span className="label-mono">Our Services</span>
          <h2 style={{ marginTop: 8 }}>Select a service to get started</h2>
        </div>
      </Reveal>

      <div className="services-grid">
        {AGENT_ORDER.map((id, i) => (
          <Reveal key={id} delay={i * 70}>
            <ServiceCard agent={AGENTS[id]} onOpen={() => onOpenAgent(id)} />
          </Reveal>
        ))}
      </div>
    </>
  )
}
