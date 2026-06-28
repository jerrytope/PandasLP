import { AGENTS, type AgentId } from '@/lib/agents'
import ServiceCard from './ServiceCard'

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
      <div className="step-header" style={{ textAlign: 'center' }}>
        <span className="label-mono">Our Services</span>
        <h2 style={{ marginTop: 8 }}>Select a service to get started</h2>
      </div>

      <div className="services-grid">
        {AGENT_ORDER.map((id, i) => (
          <ServiceCard key={id} agent={AGENTS[id]} animationDelay={`${i * 0.08}s`} onOpen={() => onOpenAgent(id)} />
        ))}
      </div>
    </>
  )
}
