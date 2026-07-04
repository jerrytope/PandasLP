'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import LandingPage from '@/components/LandingPage'
import PaymentGate from '@/components/PaymentGate'
import CustomClaim from '@/components/CustomClaim'
import EnforcementIntake from '@/components/EnforcementIntake'
import { LawyerConsultBooking } from '@/components/LawyerConsult'
import AgentChat from '@/components/AgentChat'
import AuthModal from '@/components/AuthModal'
import { AGENTS } from '@/lib/agents'
import { CUSTOM_CLAIM_FEE } from '@/lib/services'
import { getAgentPayment } from '@/lib/agentServiceMap'
import { supabase } from '@/lib/supabaseClient'

export default function App() {
  const router = useRouter()
  const [step, setStep] = useState('landing')
  const [customClaim, setCustomClaim] = useState(null)
  const [paymentContext, setPaymentContext] = useState(null)
  const [activeAgentId, setActiveAgentId] = useState(null)

  // Auth
  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  // Store agent to open after login
  const pendingAgentRef = useRef(null)

  // Resume state: pre-load a case from dashboard
  const [resumeData, setResumeData] = useState(null)
  // { caseId, messages, draftDoc }

  // Auto-kickoff message injected as the agent's first user turn (escalation flows)
  const [autoMessage, setAutoMessage] = useState(null)

  // Judgment enforcement: the original case being escalated, while we collect the
  // judgment amount before starting the new linked case
  const [enforcementSource, setEnforcementSource] = useState(null)

  // Initialise auth listener once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      // Auto-open pending agent after login
      if (session?.user && pendingAgentRef.current) {
        setActiveAgentId(pendingAgentRef.current)
        pendingAgentRef.current = null
        setAuthOpen(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Handle ?resume=<caseId>[&fileCourt=1] from dashboard
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resumeId = params.get('resume')
    const fileCourt = params.get('fileCourt')
    if (!resumeId) return

    // Clean URL without reload
    window.history.replaceState({}, '', window.location.pathname)

    async function loadResume() {
      const [{ data: caseData }, { data: msgs }] = await Promise.all([
        supabase.from('cases').select('*').eq('id', resumeId).single(),
        supabase.from('messages').select('role, content').eq('case_id', resumeId).order('created_at'),
      ])
      if (!caseData) return

      const draftDoc =
        caseData.document_title && caseData.document_body
          ? { title: caseData.document_title, body: caseData.document_body }
          : null

      setResumeData({ caseId: resumeId, messages: msgs ?? [], draftDoc })
      setActiveAgentId(caseData.agent_id)

      if (fileCourt) {
        setAutoMessage(
          "The debtor did not respond within the 7-day deadline. I'd like to proceed to file this claim at the Small Claims Court now — please prepare the necessary court filing documents using the details we already established, and let me know what else you need from me.",
        )
      }
    }

    loadResume().catch(console.error)
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
    setActiveAgentId(null)
    setResumeData(null)
    setAutoMessage(null)
    setEnforcementSource(null)
  }

  async function handleEnforcementSubmit(judgmentAmount) {
    if (!user || !enforcementSource) return

    const { data, error } = await supabase
      .from('cases')
      .insert({
        user_id: user.id,
        agent_id: 'judgment-enforcement',
        status: 'draft',
        parent_case_id: enforcementSource.id,
        judgment_amount: judgmentAmount,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('Failed to start judgment enforcement case:', error)
      return
    }

    setResumeData({ caseId: data.id, messages: [], draftDoc: null })
    setActiveAgentId('judgment-enforcement')
    setAutoMessage(
      `This is a follow-up to an earlier case${enforcementSource.document_title ? ` ("${enforcementSource.document_title}")` : ''} — the original amount owed was ₦${(enforcementSource.amount_paid ?? 0).toLocaleString()}. The court has now entered judgment in my favour for ₦${judgmentAmount.toLocaleString()}, but the debtor still hasn't paid. I need help enforcing this judgment.`,
    )
    setEnforcementSource(null)
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
    if (customClaim) {
      fetch('/api/custom-claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...customClaim, amountPaid: paymentContext?.amount ?? 0 }),
      }).catch((err) => console.error('Failed to submit custom claim:', err))
    }
    setStep('custom-confirmation')
  }

  function handlePaymentBack() {
    setStep('custom-claim')
  }

  function handleAgentApproved(agentId) {
    const payment = getAgentPayment(agentId)
    setActiveAgentId(null)
    setResumeData(null)
    setAutoMessage(null)
    if (payment.kind === 'lawyer') {
      setStep('lawyer-booking')
    } else {
      // After payment, send user to their dashboard to track progress
      router.push('/dashboard')
    }
  }

  const activeAgent = activeAgentId ? AGENTS[activeAgentId] : null
  const activePayment = activeAgentId ? getAgentPayment(activeAgentId) : null

  return (
    <>
      <Navbar
        onLogoClick={goToLanding}
        onNavServices={() => { if (step !== 'landing') goToLanding() }}
        onStartLawyerConsult={() => {
          if (!user) {
            pendingAgentRef.current = 'lawyer-consultation'
            setAuthOpen(true)
          } else {
            setActiveAgentId('lawyer-consultation')
          }
        }}
        user={user}
        onAuthClick={() => setAuthOpen(true)}
      />

      {step === 'landing' && !enforcementSource && (
        <LandingPage
          onOpenAgent={(id) => {
            if (!user) {
              pendingAgentRef.current = id
              setAuthOpen(true)
            } else {
              setActiveAgentId(id)
            }
          }}
          onStartLawyerConsult={() => {
            if (!user) {
              pendingAgentRef.current = 'lawyer-consultation'
              setAuthOpen(true)
            } else {
              setActiveAgentId('lawyer-consultation')
            }
          }}
          onStartCustomClaim={handleStartCustomClaim}
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

      {step === 'lawyer-booking' && <LawyerConsultBooking onBackToLanding={goToLanding} />}

      {activeAgent && activePayment && (
        <AgentChat
          agent={activeAgent}
          amount={activePayment.amount}
          paymentDescription={activePayment.description}
          onClose={() => { setActiveAgentId(null); setResumeData(null); setAutoMessage(null) }}
          onApproved={handleAgentApproved}
          userId={user?.id}
          initialCaseId={resumeData?.caseId}
          initialMessages={resumeData?.messages}
          initialDraftDoc={resumeData?.draftDoc}
          initialAutoMessage={autoMessage}
        />
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      <Footer />
    </>
  )
}
