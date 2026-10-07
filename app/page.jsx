'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import LandingPage from '@/components/LandingPage'
import PaymentGate from '@/components/PaymentGate'
import CustomClaim from '@/components/CustomClaim'
import EnforcementIntake from '@/components/EnforcementIntake'
import AuthModal from '@/components/AuthModal'
import WhatsAppFab from '@/components/WhatsAppFab'
import InstallAppPrompt from '@/components/InstallAppPrompt'
import { CUSTOM_CLAIM_FEE } from '@/lib/services'
import { supabase } from '@/lib/supabaseClient'
import { captureAttribution } from '@/lib/attribution'

export default function App() {
  const router = useRouter()
  const [step, setStep] = useState('landing')
  const [customClaim, setCustomClaim] = useState(null)
  const [paymentContext, setPaymentContext] = useState(null)
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  const [claimError, setClaimError] = useState('')

  // Auth
  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)

  // Judgment enforcement: the original case being escalated, while we collect the
  // judgment amount before starting the new linked case
  const [enforcementSource, setEnforcementSource] = useState(null)

  // Captured once per browser — the magic-link auth round trip drops query params, so this
  // has to happen before sign-in, not at case-creation time. See lib/attribution.ts.
  useEffect(() => {
    captureAttribution()
  }, [])

  // Sign In from a page that does not own the modal (an agent page) sends the
  // visitor here with ?signin=1. Open it for them rather than dumping them on
  // the homepage with nothing happening.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('signin') === '1') {
      setAuthOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Initialise auth listener once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) setAuthOpen(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Handle ?enforceFrom=<caseId> from dashboard — starts a NEW judgment-enforcement case
  // linked to the original demand case, once the judgment amount is confirmed below.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const parentId = params.get('enforceFrom')
    if (!parentId) return

    window.history.replaceState({}, '', window.location.pathname)

    supabase
      .from('cases')
      .select('*')
      .eq('id', parentId)
      .single()
      .then(({ data }) => {
        if (data) setEnforcementSource(data)
      })
  }, [])

  function goToLanding() {
    setStep('landing')
    setCustomClaim(null)
    setPaymentContext(null)
    setEnforcementSource(null)
  }

  function openAgent(agentId) {
    router.push(`/agent/${agentId}`)
  }

  async function handleEnforcementSubmit(judgmentAmount) {
    if (!user || !enforcementSource) return

    const { data, error } = await supabase
      .from('cases')
      .insert({
        user_id: user.id,
        agent_id: 'judgment-enforcement',
        parent_case_id: enforcementSource.id,
        judgment_amount: judgmentAmount,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('Failed to start judgment enforcement case:', error)
      return
    }

    const autoMessage = `This is a follow-up to an earlier case${enforcementSource.document_title ? ` ("${enforcementSource.document_title}")` : ''}. The original amount owed was ₦${(enforcementSource.amount_paid ?? 0).toLocaleString()}. The court has now entered judgment in my favour for ₦${judgmentAmount.toLocaleString()}, but the debtor still hasn't paid. I need help enforcing this judgment.`

    setEnforcementSource(null)
    router.push(`/agent/judgment-enforcement?resume=${data.id}&auto=${encodeURIComponent(autoMessage)}`)
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

  // The server confirms the payment with Paystack before saving the claim (see
  // app/api/custom-claim/route.ts), so the confirmation screen only shows once it has —
  // this used to fire-and-forget and show "Submitted" whether or not the claim was saved.
  async function handlePaymentSuccess(response) {
    if (!customClaim || claimSubmitting) return
    setClaimSubmitting(true)
    setClaimError('')
    try {
      const res = await fetch('/api/custom-claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...customClaim,
          reference: response.reference,
          amount: paymentContext?.amount,
          stub: Boolean(response.stub),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setClaimError(
          `${data.error || 'We could not confirm your payment.'} If you were charged, email pandaslegalpractitioners@gmail.com with payment reference ${response.reference}.`,
        )
        return
      }
      setStep('custom-confirmation')
    } catch (err) {
      console.error('Failed to submit custom claim:', err)
      setClaimError(
        `Network error. If you were charged, email pandaslegalpractitioners@gmail.com with payment reference ${response.reference}.`,
      )
    } finally {
      setClaimSubmitting(false)
    }
  }

  function handlePaymentBack() {
    setClaimError('')
    setStep('custom-claim')
  }

  return (
    <>
      <Navbar
        onLogoClick={goToLanding}
        onNavServices={() => { if (step !== 'landing') goToLanding() }}
        onStartLawyerConsult={() => openAgent('lawyer-consultation')}
        user={user}
        onAuthClick={() => setAuthOpen(true)}
      />

      <main>
        {step === 'landing' && !enforcementSource && (
          <LandingPage
            onOpenAgent={openAgent}
            onStartLawyerConsult={() => openAgent('lawyer-consultation')}
            onStartCustomClaim={handleStartCustomClaim}
            user={user}
            onRequestAuth={() => setAuthOpen(true)}
          />
        )}

        {step === 'custom-claim' && <CustomClaim onSubmit={handleCustomClaimSubmit} onBack={goToLanding} />}

        {enforcementSource && (
          <EnforcementIntake
            parentCase={enforcementSource}
            onSubmit={handleEnforcementSubmit}
            onBack={() => setEnforcementSource(null)}
          />
        )}

        {step === 'payment' && paymentContext && (
          <PaymentGate
            amount={paymentContext.amount}
            description={paymentContext.description}
            onSuccess={handlePaymentSuccess}
            onBack={handlePaymentBack}
            busy={claimSubmitting}
            error={claimError}
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
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Haven't heard from us in 24 hours? Email{' '}
                  <a href="mailto:pandaslegalpractitioners@gmail.com">pandaslegalpractitioners@gmail.com</a>{' '}
                  directly and reference your name and the date you submitted this.
                </p>
                <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={goToLanding}>
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      <Footer />
      <WhatsAppFab />
      <InstallAppPrompt />
    </>
  )
}
