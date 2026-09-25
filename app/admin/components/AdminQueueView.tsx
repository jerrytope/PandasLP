'use client'

import { DAY_MS, type AdminCaseRow, type CaseAction } from './types'
import CaseCard from './CaseCard'
import { AlertTriangle, Clock, Scale, Inbox } from 'lucide-react'

interface AdminQueueViewProps {
  cases: AdminCaseRow[]
  loading: boolean
  updatingId: string | null
  deletingId?: string | null
  confirmDeleteId?: string | null
  regeneratingId?: string | null
  togglingTestId?: string | null
  onAction: (caseId: string, action: CaseAction, reviewChecklist?: Record<string, boolean>) => void
  onDeleteAction?: (caseId: string, action: 'request' | 'cancel' | 'confirm') => void
  onRegenerateDocument?: (caseId: string) => void
  onToggleTest?: (caseId: string, isTest: boolean) => void
  onOpenDrawer: (c: AdminCaseRow) => void
}

export default function AdminQueueView({
  cases,
  loading,
  updatingId,
  deletingId,
  confirmDeleteId,
  regeneratingId,
  togglingTestId,
  onAction,
  onDeleteAction,
  onRegenerateDocument,
  onToggleTest,
  onOpenDrawer,
}: AdminQueueViewProps) {
  const now = Date.now()

  // 1. Unserved paid cases
  const unserved = cases
    .filter((c) => c.status === 'paid' && !c.is_test)
    .sort((a, b) => new Date(a.paid_at ?? a.created_at).getTime() - new Date(b.paid_at ?? b.created_at).getTime())

  // 2. Cases past deadline
  const deadlinePassed = cases.filter(
    (c) => c.status === 'letter_served' && c.deadline_at && new Date(c.deadline_at).getTime() < now && !c.is_test,
  )

  // 3. Cases filed, waiting on judgment
  const awaitingJudgment = cases.filter((c) => c.status === 'filed' && !c.is_test)

  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)' }}>
        Loading queue matters…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* SECTION 1: Awaiting Review or Serving */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-1)',
            }}
          >
            <AlertTriangle size={18} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
            <span>Awaiting Review or Formal Serving</span>
            <span
              className="badge"
              style={{
                background: unserved.length > 0 ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-1)',
                color: unserved.length > 0 ? '#d97706' : 'var(--text-3)',
              }}
            >
              {unserved.length}
            </span>
          </h2>
        </div>

        {unserved.length === 0 ? (
          <div className="card" style={{ padding: '20px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
            <Inbox size={28} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
            <div>All paid matters have been reviewed and served! Queue is clear.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {unserved.map((c) => {
              const daysSincePaid = Math.floor(
                (now - new Date(c.paid_at ?? c.created_at).getTime()) / DAY_MS,
              )
              return (
                <CaseCard
                  key={c.id}
                  c={c}
                  updatingId={updatingId}
                  deletingId={deletingId}
                  confirmDeleteId={confirmDeleteId}
                  regeneratingId={regeneratingId}
                  togglingTestId={togglingTestId}
                  onAction={onAction}
                  onDeleteAction={onDeleteAction}
                  onRegenerateDocument={onRegenerateDocument}
                  onToggleTest={onToggleTest}
                  onOpenDrawer={onOpenDrawer}
                  domId={`queue-case-${c.id}`}
                  accentColor={daysSincePaid >= 3 ? 'var(--danger)' : daysSincePaid >= 1 ? 'var(--warning)' : undefined}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: 14-Day Response Deadline Passed */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-1)',
            }}
          >
            <Clock size={18} strokeWidth={1.8} style={{ color: 'var(--warning)' }} />
            <span>Demand Deadline Expired (Escalate to Court Filing)</span>
            <span
              className="badge"
              style={{
                background: deadlinePassed.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-1)',
                color: deadlinePassed.length > 0 ? 'var(--danger)' : 'var(--text-3)',
              }}
            >
              {deadlinePassed.length}
            </span>
          </h2>
        </div>

        {deadlinePassed.length === 0 ? (
          <div className="card" style={{ padding: '20px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
            <div>No cases currently past their statutory response deadline.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deadlinePassed.map((c) => (
              <CaseCard
                key={c.id}
                c={c}
                updatingId={updatingId}
                deletingId={deletingId}
                confirmDeleteId={confirmDeleteId}
                regeneratingId={regeneratingId}
                togglingTestId={togglingTestId}
                onAction={onAction}
                onDeleteAction={onDeleteAction}
                onRegenerateDocument={onRegenerateDocument}
                onToggleTest={onToggleTest}
                onOpenDrawer={onOpenDrawer}
                domId={`queue-case-${c.id}`}
                accentColor="var(--warning)"
              />
            ))}
          </div>
        )}
      </section>

      {/* SECTION 3: Filed in Court, Awaiting Judgment */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-1)',
            }}
          >
            <Scale size={18} strokeWidth={1.8} style={{ color: '#7c3aed' }} />
            <span>Filed in Court, Awaiting Hearing or Judgment</span>
            <span className="badge" style={{ background: 'var(--bg-1)', color: 'var(--text-3)' }}>
              {awaitingJudgment.length}
            </span>
          </h2>
        </div>

        {awaitingJudgment.length === 0 ? (
          <div className="card" style={{ padding: '20px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
            <div>No cases currently pending court hearing or judgment.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {awaitingJudgment.map((c) => (
              <CaseCard
                key={c.id}
                c={c}
                updatingId={updatingId}
                deletingId={deletingId}
                confirmDeleteId={confirmDeleteId}
                regeneratingId={regeneratingId}
                togglingTestId={togglingTestId}
                onAction={onAction}
                onDeleteAction={onDeleteAction}
                onRegenerateDocument={onRegenerateDocument}
                onToggleTest={onToggleTest}
                onOpenDrawer={onOpenDrawer}
                domId={`queue-case-${c.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
