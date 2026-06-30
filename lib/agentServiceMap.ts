import type { AgentId } from './agents'
import { getServiceById, LAWYER_CONSULT_FEE } from './services'

export const AGENT_TO_SERVICE_ID: Partial<Record<AgentId, string>> = {
  'small-claims': 'small-claims',
  'recovery-of-premises': 'tenancy',
  contracts: 'contracts',
  'cac-registration': 'business-registration',
  'judgment-enforcement': 'judgment-enforcement',
}

export interface AgentPayment {
  amount: number
  description: string
  kind: 'document' | 'lawyer'
  service?: ReturnType<typeof getServiceById>
}

export function getAgentPayment(agentId: AgentId): AgentPayment {
  if (agentId === 'lawyer-consultation') {
    return {
      amount: LAWYER_CONSULT_FEE,
      description: 'Consultation fee for a 30-minute session with a lawyer.',
      kind: 'lawyer',
    }
  }

  const serviceId = AGENT_TO_SERVICE_ID[agentId]
  const service = serviceId ? getServiceById(serviceId) : undefined

  return {
    amount: service?.price ?? 0,
    description: service ? `Document generation fee for ${service.title}.` : '',
    kind: 'document',
    service,
  }
}
