'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import LandingPage from '@/components/LandingPage'
import PaymentGate from '@/components/PaymentGate'
import NextSteps from '@/components/NextSteps'
import CustomClaim from '@/components/CustomClaim'
import { LawyerConsultBooking } from '@/components/LawyerConsult'
import AgentChat from '@/components/AgentChat'
import { AGENTS } from '@/lib/agents'
import { CUSTOM_CLAIM_FEE } from '@/lib/services'
import { getAgentPayment } from '@/lib/agentServiceMap'

export default function App() {
  const [step, setStep] = useState('landing')
  const [selectedService, setSelectedService] = useState(null)
  const [customClaim, setCustomClaim] = useState(null)
  const [paymentContext, setPaymentContext] = useState(null)
  const [activeAgentId, setActiveAgentId] = useState(null)

  function goToLanding() {
    setStep('landing')
    setSelectedService(null)
    setCustomClaim(null)
    setPaymentContext(null)
    setActiveAgentId(null)
  }

  function handleStartCustomClaim() {
    setStep('custom-claim')
  }

  function handleCustomClaimSubmit(values) {
    setCustomClaim(values)
    setPaymentContext({
      amount: CUSTOM_CLAIM_FEE,
      description: 'Routing fee to connect your claim with a lawyer.',
    })
    setStep('payment')
  }

  function handlePaymentSuccess() {
    setStep('custom-confirmation')
  }

  function handlePaymentBack() {
    setStep('custom-claim')
  }

  function handleAgentApproved(agentId) {
    const payment = getAgentPayment(agentId)
    setActiveAgentId(null)
    if (payment.kind === 'lawyer') {
      setStep('lawyer-booking')
    } else if (payment.service) {
      setSelectedService(payment.service)
      setStep('next-steps')
    }
  }

  function handleUpgradeToFirmManaged() {
    setActiveAgentId('lawyer-consultation')
  }

  const activeAgent = activeAgentId ? AGENTS[activeAgentId] : null
  const activePayment = activeAgentId ? getAgentPayment(activeAgentId) : null

  return (
    <>
      <Navbar
        onLogoClick={goToLanding}
        onNavServices={() => {
          if (step !== 'landing') goToLanding()
        }}
        onStartLawyerConsult={() => setActiveAgentId('lawyer-consultation')}
      />

      {step === 'landing' && (
        <LandingPage
          onOpenAgent={(id) => setActiveAgentId(id)}
          onStartLawyerConsult={() => setActiveAgentId('lawyer-consultation')}
          onStartCustomClaim={handleStartCustomClaim}
        />
      )}

      {step === 'custom-claim' && <CustomClaim onSubmit={handleCustomClaimSubmit} onBack={goToLanding} />}

      {step === 'payment' && paymentContext && (
        <PaymentGate
          amount={paymentContext.amount}
          description={paymentContext.description}
          onSuccess={handlePaymentSuccess}
          onBack={handlePaymentBack}
        />
      )}

      {step === 'next-steps' && selectedService && (
        <NextSteps service={selectedService} onUpgrade={handleUpgradeToFirmManaged} onBackToLanding={goToLanding} />
      )}

      {step === 'custom-confirmation' && customClaim && (
        <div className="step-page">
          <div className="container">
            <div className="card" style={{ maxWidth: 480 }}>
              <span className="badge">Submitted</span>
              <h2 style={{ marginTop: 12 }}>Thanks, {customClaim.name}!</h2>
              <p style={{ color: 'var(--text-muted)' }}>
                Your claim has been routed to our legal team. A lawyer will reach out to{' '}
                {customClaim.email} within 24 hours to discuss next steps.
              </p>
              <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={goToLanding}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'lawyer-booking' && <LawyerConsultBooking onBackToLanding={goToLanding} />}

      {activeAgent && activePayment && (
        <AgentChat
          agent={activeAgent}
          amount={activePayment.amount}
          paymentDescription={activePayment.description}
          onClose={() => setActiveAgentId(null)}
          onApproved={handleAgentApproved}
        />
      )}

      <Footer />
    </>
  )
}
