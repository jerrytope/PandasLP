// Pure (no database, no network), so it is unit-tested: what a webhook to a brand's system looks
// like, how it is signed, and when a failed one is retried. Sending is lib/brandWebhooks.ts.
//
// The brand checks a call really came from us by recomputing the signature:
//   header  X-PandasLP-Signature: t=<unix seconds>,v1=<hex>
//   v1 = HMAC-SHA256(their webhook secret, "<t>.<raw request body>")
// and refusing calls whose t is more than 5 minutes old (so a captured call can't be replayed).

import { createHmac, timingSafeEqual } from 'crypto'
import { documentUrlProblem } from './brandApiInput'

export type WebhookEvent =
  | 'borrower.missing_documents'
  | 'borrower.letter_drafted'
  | 'borrower.lawyer_approved'
  | 'borrower.served'
  | 'borrower.day7_sent'
  | 'borrower.day14_sent'
  | 'borrower.awaiting_decision'
  | 'borrower.outcome'
  | 'ping'

export interface WebhookInput {
  deliveryId: string
  event: WebhookEvent
  occurredAt: string
  isTest: boolean
  caseRef: string | null
  loanId: string | null
  /** The log entry's detail (brand_case_events.detail). */
  detail: Record<string, unknown>
  siteUrl: string
}

export interface WebhookBody {
  id: string
  event: WebhookEvent
  occurred_at: string
  test: boolean
  data: Record<string, unknown>
}

/** The JSON body for one update. `id` is the delivery's id: the same on every retry, so the brand can ignore repeats. */
export function buildWebhookBody(i: WebhookInput): WebhookBody {
  const base = { case_id: i.caseRef, loan_id: i.loanId }
  let data: Record<string, unknown>
  switch (i.event) {
    case 'borrower.missing_documents':
      data = { ...base, status: 'missing_documents', missing: Array.isArray(i.detail.missing) ? i.detail.missing : [] }
      break
    case 'borrower.letter_drafted':
      data = { ...base, status: 'letter_drafted' }
      break
    case 'borrower.lawyer_approved':
      data = { ...base, status: 'lawyer_approved', letter_available: true, letter_url: letterUrl(i) }
      break
    case 'borrower.served':
      data = { ...base, status: 'served', served_at: i.occurredAt, letter_url: letterUrl(i) }
      break
    case 'borrower.day7_sent':
      data = { ...base, status: 'day7_sent', sent_at: i.occurredAt }
      break
    case 'borrower.day14_sent':
      data = { ...base, status: 'day14_sent', sent_at: i.occurredAt }
      break
    case 'borrower.awaiting_decision':
      // Day 14 has passed with no payment: Pandas LP needs the brand's decision (court or close).
      data = { ...base, status: 'day14_sent', awaiting_decision_since: i.occurredAt }
      break
    case 'borrower.outcome':
      data = { ...base, status: String(i.detail.outcome ?? ''), outcome: String(i.detail.outcome ?? '') }
      break
    case 'ping':
      data = { message: 'A test event from Pandas LP. Your endpoint is reachable and the signature can be checked.' }
      break
  }
  return { id: i.deliveryId, event: i.event, occurred_at: i.occurredAt, test: i.isTest, data }
}

function letterUrl(i: WebhookInput): string | null {
  return i.caseRef ? `${i.siteUrl.replace(/\/$/, '')}/api/v1/borrowers/${encodeURIComponent(i.caseRef)}/letter` : null
}

export function signWebhook(secret: string, body: string, unixSeconds: number): string {
  const v1 = createHmac('sha256', secret).update(`${unixSeconds}.${body}`).digest('hex')
  return `t=${unixSeconds},v1=${v1}`
}

/** What the brand's side does (also used by our tests): true if the signature is ours and recent. */
export function verifyWebhookSignature(secret: string, body: string, header: string, nowSeconds: number, toleranceSeconds = 300): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]))
  const t = Number(parts.t)
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(nowSeconds - t) > toleranceSeconds) return false
  const expected = Buffer.from(signWebhook(secret, body, t).split('v1=')[1], 'hex')
  const given = Buffer.from(parts.v1, 'hex')
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** Minutes to wait after each failed attempt. Adds up to just under 24 hours, then we give up. */
export const RETRY_DELAYS_MINUTES = [1, 5, 15, 30, 60, 120, 240, 480, 480]
export const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * After a failed attempt (attempts = how many have now been made): when to try again, or null
 * to give up, because the delays have run out or the update is more than 24 hours old.
 */
export function nextAttemptAt(attempts: number, createdAt: Date, now: Date): Date | null {
  const delay = RETRY_DELAYS_MINUTES[attempts - 1]
  if (delay === undefined) return null
  const next = new Date(now.getTime() + delay * 60_000)
  return next.getTime() - createdAt.getTime() > GIVE_UP_AFTER_MS ? null : next
}

/** Checks a web address staff are saving for a brand (the same rules as a document link). Null = fine. */
export function webhookUrlProblem(url: string): string | null {
  if (url.length > 500) return 'is too long'
  return documentUrlProblem(url)
}
