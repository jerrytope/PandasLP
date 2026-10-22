'use client'

import { AGENTS, type AgentId } from '@/lib/agents'
import { formatNaira } from '@/lib/formatNaira'
import CaseActionMenu from './CaseActionMenu'
import {
  formatDate,
  STAGE_LABEL,
  STAGE_BADGE_STYLE,
  nextActionFor,
  type AdminCaseRow,
  type CaseAction,
} from './types'
import { Phone, AlertTriangle, ExternalLink, ArrowRight, ShieldCheck, Mail } from 'lucide-react'

interface CaseCardProps {
  c: AdminCaseRow
  updatingId: string | null
  deletingId?: string | null
  confirmDeleteId?: string | null
  regeneratingId?: string | null
  togglingTestId?: string | null
  accentColor?: string
  domId?: string
  onAction: (caseId: string, action: CaseAction, reviewChecklist?: Record<string, boolean>) => void
  onDeleteAction?: (caseId: string, action: 'request' | 'cancel' | 'confirm') => void
  onRegenerateDocument?: (caseId: string) => void
  onToggleTest?: (caseId: string, isTest: boolean) => void
  onOpenDrawer: (c: AdminCaseRow) => void
}

export default function CaseCard({
  c,
  updatingId,
  deletingId,
  confirmDeleteId,
  regeneratingId,
  togglingTestId,
  accentColor,
  domId,
  onAction,
  onDeleteAction,
  onRegenerateDocument,
  onToggleTest,
  onOpenDrawer,
}: CaseCardProps) {
  const agent = AGENTS[c.agent_id as AgentId]
  const next = nextActionFor(c)
  const badgeStyle = STAGE_BADGE_STYLE[c.status] ?? STAGE_BADGE_STYLE.draft

  return (
    <div
      id={domId}
      className="card"
      style={{
        padding: '16px 20px',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        borderLeft: accentColor ? `4px solid ${accentColor}` : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--accent)',
                padding: '1px 6px',
                borderRadius: 4,
                background: 'var(--accent-glow-soft)',
                border: '1px solid var(--accent-glow)',
              }}
            >
              #{c.case_number || c.id.slice(0, 6)}
            </span>

            <span
              onClick={() => onOpenDrawer(c)}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-1)',
              }}
              className="case-title-link"
            >
              {c.document_title ?? agent?.name ?? c.agent_id}
            </span>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span>{c.userEmail || 'unknown client'}</span>
            <span>·</span>
            <span>{formatDate(c.created_at)}</span>
            {c.hasStampedDocument && (
              <>
                <span>·</span>
                <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, fontSize: 12 }}>
                  <ShieldCheck size={13} /> Stamped
                </span>
              </>
            )}
          </div>
        </div>

        {/* Status Badges */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {c.is_test && (
            <span className="badge" style={{ background: 'rgba(107,114,128,0.15)', color: 'var(--text-3)' }}>
              TEST
            </span>
          )}

          {c.negotiationStatus === 'awaiting_our_reply' && (
            <span className="badge badge-danger">
              COUNTER RECEIVED
            </span>
          )}

          <span
            className="badge"
            style={{
              background: badgeStyle.bg,
              color: badgeStyle.color,
              borderColor: badgeStyle.border,
            }}
          >
            {STAGE_LABEL[c.status] ?? c.status}
          </span>
        </div>
      </div>

      {/* Case Details Row */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 13,
          color: 'var(--text-2)',
        }}
      >
        <span>
          Paid: <strong style={{ color: c.amount_paid > 0 ? 'var(--success)' : 'inherit' }}>{formatNaira(c.amount_paid)}</strong>
        </span>

        {c.expected_amount != null && (
          <span>
            Quoted: <strong>{formatNaira(c.expected_amount)}</strong>
          </span>
        )}

        {c.delivery_option && <span>Delivery: <strong>{c.delivery_option}</strong></span>}

        {c.client_phone ? (
          <a
            href={`tel:${c.client_phone}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 500 }}
          >
            <Phone size={12} strokeWidth={2} /> {c.client_phone}
          </a>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--danger)', fontSize: 12 }}>
            <AlertTriangle size={12} /> No phone
          </span>
        )}

        {c.client_email && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}>
            <Mail size={12} /> {c.client_email}
          </span>
        )}
      </div>

      {/* Action Footer Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Primary Next Workflow Action Button */}
          {next && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={updatingId === c.id}
              onClick={() => {
                if (c.status === 'paid' && !c.reviewed_at) {
                  onOpenDrawer(c) // Open drawer to walk through review checklist
                } else {
                  onAction(c.id, next.action)
                }
              }}
            >
              {updatingId === c.id ? 'Updating…' : next.label}
              <ArrowRight size={13} strokeWidth={2} />
            </button>
          )}

          {/* Open Drawer Button for full inspection */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onOpenDrawer(c)}
            title="Inspect full case record, document, interview transcript, and evidence"
          >
            <span>Open Case</span>
            <ExternalLink size={13} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
          </button>
        </div>

        {/* Overflow Menu with Secondary & Administrative Actions */}
        <CaseActionMenu
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
        />
      </div>
    </div>
  )
}
