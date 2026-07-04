import { describe, it, expect } from 'vitest'
import { getAgentPayment } from '../agentServiceMap'
import { LAWYER_CONSULT_FEE, SERVICES } from '../services'

function priceOf(serviceId: string): number {
  const service = SERVICES.find((s) => s.id === serviceId)
  if (!service) throw new Error(`Fixture service not found: ${serviceId}`)
  return service.price
}

describe('getAgentPayment', () => {
  it('prices the lawyer consultation agent as a lawyer-kind payment', () => {
    const payment = getAgentPayment('lawyer-consultation')
    expect(payment.kind).toBe('lawyer')
    expect(payment.amount).toBe(LAWYER_CONSULT_FEE)
  })

  it('prices small-claims from its mapped service', () => {
    const payment = getAgentPayment('small-claims')
    expect(payment.kind).toBe('document')
    expect(payment.amount).toBe(priceOf('small-claims'))
  })

  it('maps recovery-of-premises to the tenancy service, not a same-named one', () => {
    const payment = getAgentPayment('recovery-of-premises')
    expect(payment.amount).toBe(priceOf('tenancy'))
  })

  it('describes the service by its title, not its internal id', () => {
    const payment = getAgentPayment('cac-registration')
    expect(payment.amount).toBe(priceOf('business-registration'))
    expect(payment.description).toContain('Business Registration')
  })
})
