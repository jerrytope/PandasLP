// Emails to a brand's BORROWER (not our client): serving the letter of demand, and the Day 7
// and Day 14 reminders. The brand (our client) is copied on each one. Pure, so the wording
// is unit-tested in lib/__tests__/brandEmails.test.ts.
//
// Tone: firm and factual, never threatening anything the firm has not been instructed to do.
// Court is only ever something the client "may instruct us" to do: nothing goes to court
// without the brand's written approval (plans/README.md).

import { baseWrapper } from './emailTemplates'
import { GMAIL_USER } from './mailer'

export const RESPONSE_PERIOD_DAYS = 14
const FIRM_PHONE = '+234 811 808 0189'

export type BorrowerEmailKind = 'service' | 'day7' | 'day14'

export interface BorrowerEmailData {
  kind: BorrowerEmailKind
  borrowerName: string
  brandName: string
  caseRef: string
  /** Naira, or null if the sheet's figure couldn't be read (the letter itself states it). */
  amountOutstanding: number | null
  /** When the letter was served (ISO). For 'service' this is now. */
  servedAt: string
}

const LAGOS_DATE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric' })

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function naira(n: number): string {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/** The last day to respond: 14 days after service, as a Lagos date. */
export function responseDeadline(servedAt: string): string {
  return LAGOS_DATE.format(new Date(new Date(servedAt).getTime() + RESPONSE_PERIOD_DAYS * 24 * 60 * 60 * 1000))
}

export function getBorrowerEmail(d: BorrowerEmailData): { subject: string; text: string; html: string } {
  const amount = d.amountOutstanding !== null ? naira(d.amountOutstanding) : 'the sum stated in our letter'
  const served = LAGOS_DATE.format(new Date(d.servedAt))
  const deadline = responseDeadline(d.servedAt)
  const ref = `Our reference: ${d.caseRef}`
  const howToResolve = [
    `To settle, pay through your usual repayment channel with ${d.brandName}, then reply to this email with proof of payment.`,
    `If you dispute the debt, or want to discuss a payment plan, reply to this email or call ${FIRM_PHONE}, quoting ${d.caseRef}.`,
  ]

  let subject: string
  let heading: string
  let paragraphs: string[]

  if (d.kind === 'service') {
    subject = `Letter of demand on behalf of ${d.brandName} | ${d.caseRef}`
    heading = 'Letter of demand'
    paragraphs = [
      `We act for ${d.brandName}. Attached is our letter of demand for ${amount}, the balance outstanding on your loan with our client.`,
      `Please read it carefully. You have ${RESPONSE_PERIOD_DAYS} days from today, until ${deadline}, to pay or to respond.`,
      ...howToResolve,
    ]
  } else if (d.kind === 'day7') {
    subject = `Reminder: 7 days left to respond | ${d.caseRef}`
    heading = '7 days left to respond'
    paragraphs = [
      `On ${served} we served you with a letter of demand on behalf of ${d.brandName} for ${amount}.`,
      `We have not yet received payment or a response. You have until ${deadline} to pay or to respond.`,
      ...howToResolve,
    ]
  } else {
    subject = `Response period ended | ${d.caseRef}`
    heading = 'The response period has ended'
    paragraphs = [
      `On ${served} we served you with a letter of demand on behalf of ${d.brandName} for ${amount}. The ${RESPONSE_PERIOD_DAYS}-day period to respond ended on ${deadline}.`,
      `We have not received payment or a response. Our client may now instruct us to take further legal steps to recover the debt, including a claim at the Small Claims Court, without further notice to you.`,
      `You can still avoid this. ${howToResolve[0]}`,
      howToResolve[1],
    ]
  }

  const greeting = `Dear ${d.borrowerName},`
  const signOff = ['Yours faithfully,', 'Pandas LP', `For and on behalf of ${d.brandName}`, `${GMAIL_USER} · ${FIRM_PHONE}`]

  const text = [greeting, '', ...paragraphs.flatMap((p) => [p, '']), ref, '', ...signOff].join('\n')
  const p = (s: string) => `<p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">${escapeHtml(s)}</p>`
  const html = baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">${escapeHtml(heading)}</h2>
      ${p(greeting)}
      ${paragraphs.map(p).join('\n      ')}
      <p style="margin:0 0 14px;font-size:13px;color:#ABB1A2;line-height:1.6;"><strong style="color:#F3EFE3;">${escapeHtml(ref)}</strong></p>
      <p style="margin:0;font-size:15px;color:#ABB1A2;line-height:1.6;">${signOff.map(escapeHtml).join('<br/>')}</p>
  `)
  return { subject, text, html }
}

// ── To the brand (our client) ─────────────────────────────────────────────

export interface BrandEditNotice {
  caseRef: string
  column: string
  oldValue: string
  newValue: string
}

/**
 * The brand changed rows we had already started work on. Nothing was done with the change:
 * the row is locked, and updates belong in the Notes column.
 */
export function getBrandEditNoticeEmail(brandName: string, edits: BrandEditNotice[]): { subject: string; text: string; html: string } {
  const show = (v: string) => (v ? `"${v}"` : '(empty)')
  const lines = edits.map((e) => `${e.caseRef}: ${e.column} changed from ${show(e.oldValue)} to ${show(e.newValue)}`)
  const intro = `We noticed changes to ${edits.length === 1 ? 'a row' : `${edits.length} rows`} in your Pandas LP sheet that we had already started working on:`
  const explain = [
    'We have not acted on these changes. Once we start work on a borrower, their row is locked, because the letter of demand is based on the details as they were.',
    'Please put any updates or corrections in the Notes column of that row instead. Our team will review each change and contact you if anything needs to happen.',
  ]
  const text = [`Dear ${brandName} team,`, '', intro, '', ...lines.map((l) => `- ${l}`), '', ...explain.flatMap((p) => [p, '']), 'Pandas LP', `${GMAIL_USER} · ${FIRM_PHONE}`].join('\n')
  const p = (s: string) => `<p style="margin:0 0 14px;font-size:15px;color:#ABB1A2;line-height:1.6;">${escapeHtml(s)}</p>`
  const html = baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">Changes to rows we're already handling</h2>
      ${p(`Dear ${brandName} team,`)}
      ${p(intro)}
      <ul style="margin:0 0 14px;padding-left:18px;font-size:14px;color:#F3EFE3;line-height:1.6;">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
      ${explain.map(p).join('\n      ')}
      <p style="margin:0;font-size:15px;color:#ABB1A2;line-height:1.6;">Pandas LP<br/>${escapeHtml(GMAIL_USER)} · ${FIRM_PHONE}</p>
  `)
  return { subject: `Changes to rows we're already handling | ${brandName}`, text, html }
}
