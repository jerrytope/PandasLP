'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authedFetch } from '@/lib/supabaseClient'
import { AGENTS } from '@/lib/agents'
import { getAgentPayment } from '@/lib/agentServiceMap'
import AgentChat from '@/components/AgentChat'

// Subcomponents
import { useAdminShell } from './components/shell/AdminShellContext'
import { parseFinanceSub, parseSection, sectionHref, sectionToTab } from './components/shell/adminSections'
import AdminOverview from './components/AdminOverview'
import AdminQueueView from './components/AdminQueueView'
import AdminCasesView from './components/AdminCasesView'
import AdminCustomClaimsView from './components/AdminCustomClaimsView'
import AdminWaitlistView from './components/AdminWaitlistView'
import CaseDetailDrawer from './components/CaseDetailDrawer'
import FinanceView from './components/finance/FinanceView'
import LeadsView from './components/LeadsView'
import BrandsView from './components/brands/BrandsView'
import SiteContentView from './components/site/SiteContentView'
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

  // Signed-in check and the "Access Restricted" screen live in the shell (app/admin/layout.tsx).
  const { userId: adminUserId, setTopbarMeta, denyAccess } = useAdminShell()

  // Active section comes from the URL (/admin?section=…), set by the sidebar's links.
  const section = parseSection(searchParams.get('section'), Boolean(deepLinkCaseId))
  const tab: Tab = sectionToTab(section)
  const financeSub = parseFinanceSub(searchParams.get('sub'))

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

  // Tab data loader
  useEffect(() => {
    loadTab(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // "N cases loaded" in the top bar, on the sections that show cases.
  useEffect(() => {
    if (tab === 'overview' || tab === 'queue' || tab === 'cases') setTopbarMeta(`${cases.length} cases loaded`)
  }, [tab, cases.length, setTopbarMeta])

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
    // Finance, Leads, Brands and Site content load their own data inside their views.
    if (which === 'finance' || which === 'leads' || which === 'brands' || which === 'site') return
    setLoading(true)
    setLoadError('')
    try {
      // Overview's KPI cards use the same data as the queue: every live case.
      if (which === 'queue' || which === 'overview') {
        const res = await authedFetch('/api/admin/cases')
        if (res.status === 403) {
          denyAccess()
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
          denyAccess()
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
          denyAccess()
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
          denyAccess()
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

  return (
    <>
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

      {/* Section Content Views */}
      <div>
        {tab === 'overview' && (
          <AdminOverview
            cases={cases}
            loading={loading}
            onSelectFilter={(status) => {
              // The matters loader reads filterStatus when the URL change below switches section.
              setFilterStatus(status)
              router.push(sectionHref('matters'))
            }}
          />
        )}

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

        {tab === 'finance' && (
          <FinanceView sub={financeSub} onSubChange={(s) => router.push(sectionHref('finance', s))} />
        )}

        {tab === 'brands' && <BrandsView />}

        {tab === 'site' && <SiteContentView />}

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
            // Switching section reloads its data (see the loader effect above).
            router.push(sectionHref('matters'))
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
    </>
  )
}
