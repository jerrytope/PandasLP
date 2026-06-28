import { AGENTS, type AgentId } from '@/lib/agents'
import { getServiceById } from '@/lib/services'
import ServiceCard from './ServiceCard'

const AGENT_ORDER: AgentId[] = [
  'small-claims',
  'recovery-of-premises',
  'contracts',
  'cac-registration',
  'lawyer-consultation',
]

const AGENT_TO_SERVICE_ID: Partial<Record<AgentId, string>> = {
  'small-claims': 'small-claims',
  'recovery-of-premises': 'tenancy',
  contracts: 'contracts',
  'cac-registration': 'business-registration',
}

interface ServicesSectionProps {
  onSelectService: (service: ReturnType<typeof getServiceById>) => void
  onStartLawyerConsult: () => void
}

export default function ServicesSection({ onSelectService, onStartLawyerConsult }: ServicesSectionProps) {
  return (
    <>
      <div className="step-header" style={{ textAlign: 'center' }}>
        <span className="label-mono">Our Services</span>
        <h2 style={{ marginTop: 8 }}>Select a service to get started</h2>
      </div>

      <div className="services-grid">
        {AGENT_ORDER.map((id, i) => {
          const agent = AGENTS[id]
          const serviceId = AGENT_TO_SERVICE_ID[id]

          return (
            <ServiceCard
              key={id}
              agent={agent}
              animationDelay={`${i * 0.08}s`}
              onContinue={() => {
                if (id === 'lawyer-consultation') {
                  onStartLawyerConsult()
                } else if (serviceId) {
                  const service = getServiceById(serviceId)
                  if (service) onSelectService(service)
                }
              }}
            />
          )
        })}
      </div>
    </>
  )
}
