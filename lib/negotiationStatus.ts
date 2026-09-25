// Where a negotiation stands after a given round, and what has to happen next. Stored on each
// case_negotiations row (see add-negotiation-next-actions.sql) so the thread records how the
// position moved; the latest round's values are the case's current state.

export const NEGOTIATION_STATUSES = ['awaiting_their_reply', 'awaiting_our_reply', 'agreed', 'broken_down'] as const
export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number]

export const NEGOTIATION_STATUS_LABEL: Record<NegotiationStatus, string> = {
  awaiting_their_reply: 'Awaiting their reply',
  awaiting_our_reply: 'Awaiting our reply',
  agreed: 'Settlement agreed',
  broken_down: 'Broken down, escalate',
}

export function isNegotiationStatus(value: unknown): value is NegotiationStatus {
  return typeof value === 'string' && (NEGOTIATION_STATUSES as readonly string[]).includes(value)
}

// A counter we received means the ball is in our court; our reply puts it in theirs.
export function defaultStatusFor(party: 'debtor_counsel' | 'pandas_lp'): NegotiationStatus {
  return party === 'debtor_counsel' ? 'awaiting_our_reply' : 'awaiting_their_reply'
}

// Due dates are calendar dates (YYYY-MM-DD), not timestamps: "the undertaking is due by the
// 30th" means the whole of the 30th in Lagos, whatever time the round was logged.
export function isDueDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

// Today's date in Lagos, as YYYY-MM-DD — what "due" and "overdue" are measured against.
export function lagosToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
}
