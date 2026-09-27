'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase, authedFetch } from '@/lib/supabaseClient'
import { AGENTS } from '@/lib/agents'
import { getAgentPayment } from '@/lib/agentServiceMap'
import AgentChat from '@/components/AgentChat'

// Subcomponents
import AdminHeader from './components/AdminHeader'
import AdminStatsOverview from './components/AdminStatsOverview'
import AdminQueueView from './components/AdminQueueView'
import AdminCasesView from './components/AdminCasesView'
import AdminCustomClaimsView from './components/AdminCustomClaimsView'
import AdminWaitlistView from './components/AdminWaitlistView'
import CaseDetailDrawer from './components/CaseDetailDrawer'
import FinanceView from './components/finance/FinanceView'
import LeadsView from './components/LeadsView'
import type {
  AdminCaseRow,
  CustomClaimRow,
  WaitlistRow,
  Tab,
  CaseAction,
} from './components/types'

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPageInner />
    </Suspense>
  )
}

function AdminPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deepLinkCaseId = searchParams.get('caseId')

  // Auth & Permissions
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [adminUserEmail, setAdminUserEmail] = useState<string | null>(null)
  const [adminUserId, setAdminUserId] = useState<string | null>(null)

  // Active Navigation Tab
  const [tab, setTab] = useState<Tab>(deepLinkCaseId ? 'cases' : 'queue')

  // Data Stores
  const [cases, setCases] = useState<AdminCaseRow[]>([])
  const [claims, setClaims] = useState<CustomClaimRow[]>([])
  const [signups, setSignups] = useState<WaitlistRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  // Drawer Selection
  const [selectedCase, setSelectedCase] = useState<AdminCaseRow | null>(null)

  // Filters (for Cases tab)
  const [filterAgent, setFilterAgent] = useState('')
  const [filterTest, setFilterTest] = useState<'live' | 'test' | 'all'>('live')
  const [filterStatus, setFilterStatus] = useState('')

  // Action Loading Indicators
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [togglingTestId, setTogglingTestId] = useState<string | null>(null)
  const [secondReviewingId, setSecondReviewingId] = useState<string | null>(null)
  const [savingClientEmailId, setSavingClientEmailId] = useState<string | null>(null)
  const [savingRecipientPhoneId, setSavingRecipientPhoneId] = useState<string | null>(null)

  // Offline Lawyer Intake Session
  const [lawyerIntakeSeed, setLawyerIntakeSeed] = useState<string | null>(null)

  // Auth bootstrap
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/')
        return
      }
      setAdminUserId(session.user.id)
      setAdminUserEmail(session.user.email ?? null)
      setCheckedAuth(true)
    })
  }, [router])

  // Tab data loader
  useEffect(() => {
    if (!checkedAuth) return
    loadTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedAuth, tab])

  // Handle deep link scroll and auto-drawer selection
  useEffect(() => {
    if (!deepLinkCaseId || cases.length === 0) return
    const target = cases.find((c) => c.id === deepLinkCaseId)
    if (target && !selectedCase) {
      setSelectedCase(target)
    }
    const el = document.getElementById(`case-${deepLinkCaseId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [deepLinkCaseId, cases])

  async function loadTab(
    which: Tab,
    overrideStatus?: string,
    overrideTest?: 'live' | 'test' | 'all',
    overrideAgent?: string,
  ) {
    // Finance and Leads load their own data inside their views.
    if (which === 'finance' || which === 'leads') return
    setLoading(true)
    setLoadError('')
    try {
      if (which === 'queue') {
        const res = await authedFetch('/api/admin/cases')
        if (res.status === 403) {
          setAccessDenied(true)
          return
        }
        const data = await res.json()
        if (!res.ok) {
          setLoadError(data.error || 'Failed to load queue.')
          return
        }
        setCases(data.cases ?? [])
      } else if (which === 'cases') {
        const statusToUse = overrideStatus !== undefined ? overrideStatus : filterStatus
        const hasDocumentOnly = statusToUse === 'has_document'
        const params = new URLSearchParams()
        if (statusToUse && !hasDocumentOnly) params.set('status', statusToUse)
        const agentToUse = overrideAgent !== undefined ? overrideAgent : filterAgent
        if (agentToUse) params.set('agentId', agentToUse)
        params.set('testFilter', overrideTest !== undefined ? overrideTest : filterTest)

        const res = await authedFetch(`/api/admin/cases?${params.toString()}`)
        if (res.status === 403) {
          setAccessDenied(true)
          return
        }
        const data = await res.json()
        if (!res.ok) {
          setLoadError(data.error || 'Failed to load cases.')
          return
        }
        const loaded: AdminCaseRow[] = data.cases ?? []
        setCases(hasDocumentOnly ? loaded.filter((c) => c.document_body) : loaded)
      } else if (which === 'claims') {
        const res = await authedFetch('/api/admin/custom-claims')
        if (res.status === 403) {
          setAccessDenied(true)
          return
        }
        const data = await res.json()
        if (!res.ok) {
          setLoadError(data.error || 'Failed to load custom claims.')
          return
        }
        setClaims(data.claims ?? [])
      } else {
        const res = await authedFetch('/api/admin/waitlist')
        if (res.status === 403) {
          setAccessDenied(true)
          return
        }
        const data = await res.json()
        if (!res.ok) {
          setLoadError(data.error || 'Failed to load waitlist signups.')
          return
        }
        setSignups(data.signups ?? [])
      }
    } catch {
      setLoadError('Network error while connecting to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Lifecycle status progression handler
  async function handleStatusAction(
    caseId: string,
    action: CaseAction,
    reviewChecklist?: Record<string, boolean>,
  ) {
    setUpdatingId(caseId)
    try {
      const res = await authedFetch('/api/update-case-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, action, reviewChecklist }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not update this matter.')
        return
      }
      if (action === 'markServed') {
        await authedFetch('/api/send-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ caseId, day: 0 }),
        }).catch((err) => console.error('Failed to send Day-0 notification:', err))
      }
      await loadTab(tab)
      if (selectedCase && selectedCase.id === caseId) {
        // Refresh selected case in drawer
        const updatedRes = await authedFetch('/api/admin/cases')
        const updatedData = await updatedRes.json()
        const refreshed = (updatedData.cases as AdminCaseRow[])?.find((c) => c.id === caseId)
        if (refreshed) setSelectedCase(refreshed)
      }
    } catch {
      setLoadError('Network error while executing action.')
    } finally {
      setUpdatingId(null)
    }
  }

  // Delete case handler
  async function handleDeleteAction(caseId: string, action: 'request' | 'cancel' | 'confirm') {
    if (action === 'request') {
      setConfirmDeleteId(caseId)
    } else if (action === 'cancel') {
      setConfirmDeleteId(null)
    } else if (action === 'confirm') {
      setDeletingId(caseId)
      try {
        const res = await authedFetch(`/api/admin/cases?caseId=${caseId}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          setLoadError(data.error || 'Could not delete this case.')
          return
        }
        setCases((prev) => prev.filter((c) => c.id !== caseId))
        if (selectedCase?.id === caseId) setSelectedCase(null)
        setConfirmDeleteId(null)
      } catch {
        setLoadError('Network error while deleting case.')
      } finally {
        setDeletingId(null)
      }
    }
  }

  // Toggle Test / Live flag
  async function handleToggleTest(caseId: string, isTest: boolean) {
    setTogglingTestId(caseId)
    try {
      const res = await authedFetch('/api/admin/cases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, isTest }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not update test status.')
        return
      }
      if (filterTest === 'live' && isTest) setCases((prev) => prev.filter((c) => c.id !== caseId))
      else if (filterTest === 'test' && !isTest) setCases((prev) => prev.filter((c) => c.id !== caseId))
      else setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, is_test: isTest } : c)))

      if (selectedCase?.id === caseId) {
        setSelectedCase((prev) => (prev ? { ...prev, is_test: isTest } : null))
      }
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setTogglingTestId(null)
    }
  }

  // High risk second reviewer confirmation
  async function handleSecondReview(caseId: string, email: string) {
    setSecondReviewingId(caseId)
    try {
      const res = await authedFetch('/api/admin/cases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, secondReviewerEmail: email }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not record second reviewer.')
        return
      }
      const now = new Date().toISOString()
      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? { ...c, second_reviewer_email: email, second_reviewed_at: now }
            : c,
        ),
      )
      if (selectedCase?.id === caseId) {
        setSelectedCase((prev) =>
          prev ? { ...prev, second_reviewer_email: email, second_reviewed_at: now } : null,
        )
      }
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setSecondReviewingId(null)
    }
  }

  // Save client delivery email
  async function handleSaveClientEmail(caseId: string, email: string) {
    setSavingClientEmailId(caseId)
    try {
      const res = await authedFetch('/api/admin/cases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, clientEmail: email }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not save client email.')
        return
      }
      setCases((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, client_email: email || null } : c)),
      )
      if (selectedCase?.id === caseId) {
        setSelectedCase((prev) => (prev ? { ...prev, client_email: email || null } : null))
      }
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setSavingClientEmailId(null)
    }
  }

  // Save debtor / recipient phone
  async function handleSaveRecipientPhone(caseId: string, phone: string) {
    setSavingRecipientPhoneId(caseId)
    try {
      const res = await authedFetch('/api/admin/cases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId, recipientPhone: phone }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not save debtor phone.')
        return
      }
      setCases((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, recipient_phone: phone || null } : c)),
      )
      if (selectedCase?.id === caseId) {
        setSelectedCase((prev) => (prev ? { ...prev, recipient_phone: phone || null } : null))
      }
    } catch {
      setLoadError('Network error. Please try again.')
    } finally {
      setSavingRecipientPhoneId(null)
    }
  }

  // Regenerate document from interview transcript
  async function handleRegenerateDocument(caseId: string) {
    setRegeneratingId(caseId)
    setLoadError('')
    try {
      const res = await authedFetch('/api/admin/regenerate-document', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setLoadError(data.error || 'Could not regenerate this document.')
        return
      }
      await loadTab(tab)
    } catch {
      setLoadError('Network error while regenerating document.')
    } finally {
      setRegeneratingId(null)
    }
  }

  // Reload current case state (e.g. after stamp upload)
  async function handleReloadCase() {
    await loadTab(tab)
    if (selectedCase) {
      const res = await authedFetch('/api/admin/cases')
      const data = await res.json()
      const refreshed = (data.cases as AdminCaseRow[])?.find((c) => c.id === selectedCase.id)
      if (refreshed) setSelectedCase(refreshed)
    }
  }

  if (!checkedAuth) return null

  if (accessDenied) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-0)',
          color: 'var(--text-1)',
          padding: 24,
        }}
      >
        <div className="card" style={{ maxWidth: 420, textAlign: 'center', padding: '36px 28px' }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 24 }}>
            Access Restricted
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
            This command center is restricted to authorized Pandas LP legal practitioners and staff.
          </p>
          <Link
            href="/dashboard"
            className="btn btn-primary"
            style={{ marginTop: 20, display: 'inline-flex' }}
          >
            Return to Client Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-1)' }}>
      {/* Top Header */}
      <AdminHeader userEmail={adminUserEmail} casesCount={cases.length} />

      <main className="container" style={{ paddingTop: 36, paddingBottom: 96 }}>
        {/* Page Title & Quick Action Strip */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <span className="label-mono" style={{ color: 'var(--accent)' }}>Legal Operations</span>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(26px, 3.5vw, 36px)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginTop: 4,
              }}
            >
              Command Center
            </h1>
          </div>
        </div>

        {/* Global KPI and SLA Overview */}
        <AdminStatsOverview
          cases={cases}
          onSelectFilter={(status) => {
            setFilterStatus(status)
            setTab('cases')
            loadTab('cases', status)
          }}
        />

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Admin operational sections"
          style={{
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            rowGap: 0,
            marginBottom: 24,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {(['queue', 'leads', 'cases', 'claims', 'finance', 'waitlist'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '12px 4px',
                fontSize: 14,
                fontWeight: 600,
                color: tab === t ? 'var(--accent)' : 'var(--text-2)',
                transition: 'color 0.2s',
              }}
            >
              {t === 'queue'
                ? 'Action Queue'
                : t === 'leads'
                ? 'Leads'
                : t === 'cases'
                ? 'All Matters'
                : t === 'claims'
                ? 'Custom Claims'
                : t === 'finance'
                ? 'Finance'
                : 'Waitlist Signups'}
              {tab === t && (
                <motion.div
                  layoutId="admin-tab-underline"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: 2,
                    background: 'var(--accent)',
                  }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Error Alert Box */}
        {loadError && (
          <div
            role="alert"
            className="card"
            style={{
              borderColor: 'var(--danger)',
              marginBottom: 20,
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ color: 'var(--danger)', fontSize: 14 }}>{loadError}</span>
            <button type="button" className="btn btn-sm" onClick={() => setLoadError('')}>
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Content Views */}
        <div role="tabpanel">
          {tab === 'queue' && (
            <AdminQueueView
              cases={cases}
              loading={loading}
              updatingId={updatingId}
              deletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              regeneratingId={regeneratingId}
              togglingTestId={togglingTestId}
              onAction={handleStatusAction}
              onDeleteAction={handleDeleteAction}
              onRegenerateDocument={handleRegenerateDocument}
              onToggleTest={handleToggleTest}
              onOpenDrawer={(c) => setSelectedCase(c)}
            />
          )}

          {tab === 'cases' && (
            <AdminCasesView
              cases={cases}
              loading={loading}
              updatingId={updatingId}
              deletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              regeneratingId={regeneratingId}
              togglingTestId={togglingTestId}
              filterAgent={filterAgent}
              filterTest={filterTest}
              filterStatus={filterStatus}
              deepLinkCaseId={deepLinkCaseId}
              onAgentChange={(agentId) => {
                setFilterAgent(agentId)
                loadTab('cases', undefined, undefined, agentId)
              }}
              onTestFilterChange={(testFilter) => {
                setFilterTest(testFilter)
                loadTab('cases', undefined, testFilter)
              }}
              onStatusChange={(status) => {
                setFilterStatus(status)
                loadTab('cases', status)
              }}
              onAction={handleStatusAction}
              onDeleteAction={handleDeleteAction}
              onRegenerateDocument={handleRegenerateDocument}
              onToggleTest={handleToggleTest}
              onOpenDrawer={(c) => setSelectedCase(c)}
            />
          )}

          {tab === 'claims' && (
            <AdminCustomClaimsView
              claims={claims}
              loading={loading}
              onStartIntake={(seedPrompt) => setLawyerIntakeSeed(seedPrompt)}
            />
          )}

          {tab === 'finance' && <FinanceView />}

          {tab === 'leads' && <LeadsView onStartIntake={(seed) => setLawyerIntakeSeed(seed)} />}

          {tab === 'waitlist' && (
            <AdminWaitlistView signups={signups} loading={loading} />
          )}
        </div>

        {/* Offline Agent Intake Chat Session */}
        {lawyerIntakeSeed !== null && adminUserId && (
          <AgentChat
            lawyerIntake
            agent={AGENTS['small-claims']}
            amount={getAgentPayment('small-claims').amount}
            paymentDescription={getAgentPayment('small-claims').description}
            userId={adminUserId}
            initialAutoMessage={lawyerIntakeSeed || undefined}
            onClose={() => setLawyerIntakeSeed(null)}
            onApproved={() => {
              setLawyerIntakeSeed(null)
              setTab('cases')
              loadTab('cases')
            }}
          />
        )}

        {/* Side-by-Side Legal Case Drawer */}
        <CaseDetailDrawer
          c={selectedCase}
          onClose={() => setSelectedCase(null)}
          updatingId={updatingId}
          deletingId={deletingId}
          confirmDeleteId={confirmDeleteId}
          regeneratingId={regeneratingId}
          togglingTestId={togglingTestId}
          secondReviewingId={secondReviewingId}
          savingClientEmailId={savingClientEmailId}
          savingRecipientPhoneId={savingRecipientPhoneId}
          onAction={handleStatusAction}
          onDeleteAction={handleDeleteAction}
          onRegenerateDocument={handleRegenerateDocument}
          onToggleTest={handleToggleTest}
          onSecondReview={handleSecondReview}
          onSaveClientEmail={handleSaveClientEmail}
          onSaveRecipientPhone={handleSaveRecipientPhone}
          onReloadCase={handleReloadCase}
        />
      </main>
    </div>
  )
}
