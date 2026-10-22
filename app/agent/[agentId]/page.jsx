'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AgentChat from '@/components/AgentChat'
import AuthModal from '@/components/AuthModal'
import { LawyerConsultBooking } from '@/components/LawyerConsult'
import { AGENTS } from '@/lib/agents'
import { getAgentPayment } from '@/lib/agentServiceMap'
import { supabase } from '@/lib/supabaseClient'
import { captureAttribution } from '@/lib/attribution'

const AUTO_FILE_COURT_MESSAGE =
  "The debtor did not respond within the 14-day deadline. I'd like to proceed to file this claim at the Small Claims Court now. Please prepare the necessary court filing documents using the details we already established, and let me know what else you need from me."

export default function AgentPage() {
  return (
    <Suspense fallback={null}>
      <AgentPageInner />
    </Suspense>
  )
}

function AgentPageInner() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const agentId = params.agentId

  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [approvedLawyer, setApprovedLawyer] = useState(false)

  const [resumeData, setResumeData] = useState(null)
  const [autoMessage, setAutoMessage] = useState(null)
  const [resumeLoading, setResumeLoading] = useState(false)

  const agent = AGENTS[agentId]
  const payment = agent ? getAgentPayment(agentId) : null

  // Captured once per browser — a visitor referred straight here (e.g. from the ChatGPT
  // plugin, ?ref=chatgpt) skips the homepage entirely, so app/page.jsx's own capture call
  // never runs for them. See lib/attribution.ts.
  useEffect(() => {
    captureAttribution()
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthChecked(true)
      if (!session?.user) setAuthOpen(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) setAuthOpen(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (authChecked && !agent) router.replace('/')
  }, [authChecked, agent, router])

  useEffect(() => {
    const resumeId = searchParams.get('resume')
    const fileCourt = searchParams.get('fileCourt')
    const auto = searchParams.get('auto')
    if (!resumeId && !auto && !fileCourt) return

    if (!resumeId) {
      // No existing case to resume (e.g. a fresh ChatGPT-plugin referral) — just seed the
      // auto-message; AgentChat's own ensureCase() lazily creates the case on first send.
      if (auto) setAutoMessage(auto)
      else if (fileCourt) setAutoMessage(AUTO_FILE_COURT_MESSAGE)
      return
    }

    setResumeLoading(true)

    async function loadResume() {
      const [{ data: caseData }, { data: msgs }] = await Promise.all([
        supabase.from('cases').select('*').eq('id', resumeId).single(),
        supabase.from('messages').select('role, content').eq('case_id', resumeId).order('created_at'),
      ])
      if (!caseData) {
        setResumeLoading(false)
        return
      }

      const draftDoc =
        caseData.document_title && caseData.document_body
          ? { title: caseData.document_title, body: caseData.document_body, price: caseData.expected_amount ?? null }
          : null

      const alreadyPaid = ['paid', 'letter_served', 'filed', 'judgment_obtained', 'closed'].includes(caseData.status)

      setResumeData({ caseId: resumeId, messages: msgs ?? [], draftDoc, clientPhone: caseData.client_phone ?? null, initialPaid: alreadyPaid })
      if (auto) setAutoMessage(auto)
      else if (fileCourt) setAutoMessage(AUTO_FILE_COURT_MESSAGE)
      setResumeLoading(false)
    }

    loadResume().catch((err) => {
      console.error('Failed to load resumed case:', err)
      setResumeLoading(false)
    })
  }, [searchParams])

  function handleApproved() {
    if (payment?.kind === 'lawyer') {
      setApprovedLawyer(true)
    } else {
      router.push('/dashboard')
    }
  }

  if (!agent || !payment) return null

  return (
    <>
      <Navbar
        onLogoClick={() => router.push('/')}
        user={user}
        onAuthClick={() => setAuthOpen(true)}
      />

      {approvedLawyer ? (
        <LawyerConsultBooking onBackToLanding={() => router.push('/')} />
      ) : !user ? (
        authOpen && <AuthModal onClose={() => router.push('/')} />
      ) : resumeLoading ? (
        <div
          style={{
            minHeight: '80dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}
        >
          Loading your case…
        </div>
      ) : (
        <AgentChat
          fullPage
          agent={agent}
          amount={payment.amount}
          paymentDescription={payment.description}
          onClose={() => router.push('/')}
          onApproved={handleApproved}
          userId={user.id}
          initialCaseId={resumeData?.caseId}
          initialMessages={resumeData?.messages}
          initialDraftDoc={resumeData?.draftDoc}
          initialAutoMessage={autoMessage}
          initialClientPhone={resumeData?.clientPhone}
          initialPaid={resumeData?.initialPaid ?? false}
        />
      )}

      <Footer />
    </>
  )
}
