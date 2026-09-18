import { createHash, randomBytes } from 'crypto'

export type ServiceRecordStatus = 'dispatched' | 'link_opened' | 'acknowledged'

export interface ServiceMessageInput {
  caseRef: string
  documentTitle: string
  serveUrl: string
}

// The message pre-filled into WhatsApp — staff still has to press send themselves inside
// WhatsApp, so "dispatched" means "staff initiated this," not "WhatsApp confirmed delivery."
// See lib/emailTemplates.ts's tone for the house style this borrows from.
export function buildServiceMessage({ caseRef, documentTitle, serveUrl }: ServiceMessageInput): string {
  return [
    `Pandas LP — Notice of Service`,
    ``,
    `Re: ${documentTitle} (Ref: ${caseRef})`,
    ``,
    `A legal document has been prepared regarding a matter involving you. View it here:`,
    serveUrl,
    ``,
    `Pandas LP — Licensed Legal Practitioners, Lagos, Nigeria`,
    `pandaslegalpractitioners@gmail.com | +234 811 808 0189`,
  ].join('\n')
}

// Same shape as buildServiceMessage, worded for a reply to an already-open negotiation
// rather than an opening notice of service — see NegotiationPanel.tsx's "Serve Reply via
// WhatsApp" and app/serve/[token]/page.tsx, which renders the negotiation round's own text
// instead of the case's original document_body when a service_records row carries a
// negotiation_id.
export function buildNegotiationReplyMessage({ caseRef, documentTitle, serveUrl }: ServiceMessageInput): string {
  return [
    `Pandas LP — Reply on Your Matter`,
    ``,
    `Re: ${documentTitle} (Ref: ${caseRef})`,
    ``,
    `Our reply regarding this matter is ready. View it here:`,
    serveUrl,
    ``,
    `Pandas LP — Licensed Legal Practitioners, Lagos, Nigeria`,
    `pandaslegalpractitioners@gmail.com | +234 811 808 0189`,
  ].join('\n')
}

// wa.me requires digits only (no +, spaces, or leading zeros replaced with country code) —
// this does the minimum normalization: strips everything but digits, and assumes a Nigerian
// local number (0XXXXXXXXXX) if no country code was included, since that's what client_phone
// is collected as throughout this app (see AgentChat.tsx's CLIENT_PHONE block).
export function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0')) return `234${digits.slice(1)}`
  return digits
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizePhoneForWhatsApp(phone)
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function hashMessage(message: string): string {
  return createHash('sha256').update(message).digest('hex')
}

// 32 bytes of randomness — the public /serve/<token> page looks up a service_record by this
// alone, so it has to be infeasible to guess. Never derived from case_id or anything
// predictable; a leaked or guessed token exposes exactly one served document, nothing else.
export function generateAccessToken(): string {
  return randomBytes(32).toString('hex')
}
