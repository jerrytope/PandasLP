import type { AgentId } from '@/lib/agents'

export interface AdminCaseRow {
  id: string
  case_number: number
  user_id: string
  userEmail: string
  agent_id: string
  status: string
  document_title: string | null
  document_body: string | null
  amount_paid: number
  expected_amount: number | null
  delivery_option: string | null
  client_phone: string | null
  client_email: string | null
  recipient_phone: string | null
  hasStampedDocument: boolean
  negotiationStatus: 'awaiting_our_reply' | 'awaiting_their_reply' | null
  created_at: string
  paid_at: string | null
  deadline_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  reviewed_document_sent_at: string | null
  source: string | null
  is_test: boolean
  review_checklist: Record<string, boolean> | null
  second_reviewer_email: string | null
  second_reviewed_at: string | null
}

export interface ServiceRecordRow {
  id: string
  channel: string
  recipient_phone: string
  status: 'dispatched' | 'link_opened' | 'acknowledged'
  dispatched_at: string
  link_opened_at: string | null
  acknowledged_at: string | null
  acknowledged_by: string | null
}

export interface CustomClaimRow {
  id: string
  name: string
  email: string
  phone: string | null
  description: string
  amount_paid: number
  status: string
  notified: boolean
  created_at: string
}

export interface WaitlistRow {
  id: string
  service: string
  email: string
  created_at: string
}

export interface CaseMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface CaseEvidenceRow {
  id: string
  filename: string
  mediaType: string
  sizeBytes: number | null
  extractedFacts: string | null
  createdAt: string
  url: string | null
}

export type Tab = 'overview' | 'queue' | 'cases' | 'brands' | 'claims' | 'waitlist' | 'finance' | 'leads'

export type CaseAction =
  | 'markReviewed'
  | 'sendReviewedDocument'
  | 'markServed'
  | 'markFiled'
  | 'markJudgment'
  | 'markClosed'
  | 'markPaidOffline'

export const STAGE_LABEL: Record<string, string> = {
  draft: 'Interview',
  document_ready: 'Doc Ready',
  paid: 'Paid',
  letter_served: 'Letter Served',
  filed: 'Filed in Court',
  judgment_obtained: 'Judgment Won',
  closed: 'Closed',
}

export const STAGE_BADGE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  draft: { bg: 'var(--bg-1)', color: 'var(--text-2)', border: 'var(--border-subtle)' },
  document_ready: { bg: 'rgba(184, 134, 11, 0.1)', color: 'var(--accent)', border: 'rgba(184, 134, 11, 0.25)' },
  paid: { bg: 'rgba(56, 189, 248, 0.12)', color: '#0284c7', border: 'rgba(56, 189, 248, 0.25)' },
  letter_served: { bg: 'rgba(217, 119, 6, 0.12)', color: '#d97706', border: 'rgba(217, 119, 6, 0.25)' },
  filed: { bg: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', border: 'rgba(124, 58, 237, 0.25)' },
  judgment_obtained: { bg: 'rgba(22, 163, 74, 0.12)', color: '#16a34a', border: 'rgba(22, 163, 74, 0.25)' },
  closed: { bg: 'var(--bg-1)', color: 'var(--text-3)', border: 'var(--border-subtle)' },
}

export const NEXT_ACTION: Record<string, { action: CaseAction; label: string } | undefined> = {
  letter_served: { action: 'markFiled', label: 'Mark Filed in Court' },
  filed: { action: 'markJudgment', label: 'Mark Judgment Won' },
  judgment_obtained: { action: 'markClosed', label: 'Close Case' },
}

export function nextActionFor(c: AdminCaseRow): { action: CaseAction; label: string } | undefined {
  if (c.status === 'paid') {
    return c.reviewed_at
      ? { action: 'markServed', label: 'Mark Served' }
      : { action: 'markReviewed', label: 'Review & Verify Checklist' }
  }
  return NEXT_ACTION[c.status]
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const DAY_MS = 24 * 60 * 60 * 1000
