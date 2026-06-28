'use client'

import { useState } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import LandingPage from '@/components/LandingPage'
import IntakeForm from '@/components/IntakeForm'
import PaymentGate from '@/components/PaymentGate'
import DocumentReview from '@/components/DocumentReview'
import NextSteps from '@/components/NextSteps'
import CustomClaim from '@/components/CustomClaim'
import { LawyerConsultIntro, LawyerConsultBooking } from '@/components/LawyerConsult'
import { CUSTOM_CLAIM_FEE, LAWYER_CONSULT_FEE } from '@/lib/services'

export default function App() {
  const [step, setStep] = useState('landing')
  const [selectedService, setSelectedService] = useState(null)
  const [formData, setFormData] = useState(null)
  const [customClaim, setCustomClaim] = useState(null)
  const [paymentContext, setPaymentContext] = useState(null)

  function goToLanding() {
    setStep('landing')
    setSelectedService(null)
    setFormData(null)
    setCustomClaim(null)
    setPaymentContext(null)
  }

  function handleSelectService(service) {
    setSelectedService(service)
    setStep('intake')
  }

  function handleIntakeSubmit(values) {
    setFormData(values)
    setPaymentContext({
      type: 'service',
      amount: selectedService.price,
      description: `Document generation fee for ${selectedService.title}.`,
    })
    setStep('payment')
  }

  function handleStartCustomClaim() {
    setStep('custom-claim')
  }

  function handleCustomClaimSubmit(values) {
    setCustomClaim(values)
    setPaymentContext({
      type: 'custom',
      amount: CUSTOM_CLAIM_FEE,
      description: 'Routing fee to connect your claim with a lawyer.',
    })
    setStep('payment')
  }

  function handleStartLawyerConsult() {
    setStep('lawyer-intro')
  }

  function handleLawyerProceed() {
    setPaymentContext({
      type: 'lawyer',
      amount: LAWYER_CONSULT_FEE,
      description: 'Consultation fee for a 30-minute session with a lawyer.',
    })
    setStep('payment')
  }

  function handlePaymentSuccess() {
    if (paymentContext.type === 'service') {
      setStep('review')
    } else if (paymentContext.type === 'custom') {
      setStep('custom-confirmation')
    } else if (paymentContext.type === 'lawyer') {
      setStep('lawyer-booking')
    }
  }

  function handlePaymentBack() {
    if (paymentContext?.type === 'service') setStep('intake')
    else if (paymentContext?.type === 'custom') setStep('custom-claim')
    else if (paymentContext?.type === 'lawyer') setStep('lawyer-intro')
    else goToLanding()
  }

  function handleUpgradeToFirmManaged() {
    setStep('lawyer-intro')
  }

  return (
    <>
      <Navbar
        onLogoClick={goToLanding}
        onNavServices={() => {
          if (step !== 'landing') goToLanding()
        }}
        onStartLawyerConsult={handleStartLawyerConsult}
      />

      {step === 'landing' && (
        <LandingPage
          onSelectService={handleSelectService}
          onStartLawyerConsult={handleStartLawyerConsult}
          onStartCustomClaim={handleStartCustomClaim}
        />
      )}

      {step === 'intake' && selectedService && (
        <IntakeForm service={selectedService} onSubmit={handleIntakeSubmit} onBack={goToLanding} />
      )}

      {step === 'custom-claim' && (
        <CustomClaim onSubmit={handleCustomClaimSubmit} onBack={goToLanding} />
      )}

      {step === 'lawyer-intro' && (
        <LawyerConsultIntro onProceed={handleLawyerProceed} onBack={goToLanding} />
      )}

      {step === 'payment' && paymentContext && (
        <PaymentGate
          amount={paymentContext.amount}
          description={paymentContext.description}
          onSuccess={handlePaymentSuccess}
          onBack={handlePaymentBack}
        />
      )}

      {step === 'review' && selectedService && formData && (
        <DocumentReview
          service={selectedService}
          formData={formData}
          onNext={() => setStep('next-steps')}
          onBack={() => setStep('payment')}
        />
      )}

      {step === 'next-steps' && selectedService && (
        <NextSteps
          service={selectedService}
          onUpgrade={handleUpgradeToFirmManaged}
          onBackToLanding={goToLanding}
        />
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

      <Footer />
    </>
  )
}
