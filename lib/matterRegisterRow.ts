import { lagosToday } from './negotiationStatus'

export function nairaFigure(text: string | null | undefined): number | null {
  const match = (text ?? '').match(/₦\s?([\d,]+(?:\.\d{1,2})?)/)
  if (!match) return null
  const amount = Number(match[1].replace(/,/g, ''))
  return Number.isFinite(amount) ? amount : null
}

export function matterName(title: string | null, client: string | null, debtor: string | null): string {
  const fromTitle = (title ?? '').replace(/^\s*letter of demand\s*[—–-]\s*/i, '').trim()
  if (fromTitle && fromTitle.toLowerCase() !== 'letter of demand') return fromTitle
  if (client && debtor) return `${client} v ${debtor}`
  return debtor || client || title || 'Untitled matter'
}

export interface RegisterRow {
  caseId: string
  fileNumber: number | null
  systemRef: string
  matter: string
  client: string
  contact: string
  amountOwed: number | null
  status: 'Outstanding' | 'Cleared'
  actionItem: string
  discussion: string
  dateOpened: string
  lastUpdated: string
}

function extractLetterFacts(body: string | null) {
  const lines = (body ?? '').split('\n').map((line) => line.trim())
  const refIndex = lines.findIndex((line) => /^Our Ref:/i.test(line))
  const afterRef = lines.slice(refIndex + 1).find((line) => line !== '')
  const debtor = refIndex >= 0 && afterRef && !/^Dear\b/i.test(afterRef)
    ? afterRef.replace(/\*\*/g, '').trim()
    : ''
  const text = (body ?? '').replace(/\*\*/g, '').trim()
  const clientMatch = text.match(/legal representatives of (.+?) of .+?\(\s*["“]?our Client/i)
    ?? text.match(/on behalf of our Client,? (.+?) of /i)
  const amountMatch = (body ?? '').match(/demand payment of the sum of \*\*(.+?)\*\*/i)
    ?? (body ?? '').match(/\*\*(₦[\d,]+(?:\.\d{2})?(?: \([^)]+\))?)\*\*/)
  const amountLine = amountMatch?.[1] ?? null
  const reference = text.match(/Our Ref(?:erence)?\s*:\s*([A-Z0-9/()-]+)/i)?.[1] ?? null
  return { client: clientMatch?.[1].trim() ?? '', debtor, amountLine, reference }
}

export function buildRegisterRow(
  c: {
    id: string
    case_number: number | null
    status: string
    created_at: string
    paid_at: string | null
    document_title: string | null
    document_body: string | null
    amount_paid: number | null
    delivery_option: string | null
    client_phone: string | null
    client_email: string | null
    userEmail: string | null
  },
  today = lagosToday(),
): RegisterRow {
  const facts = extractLetterFacts(c.document_body)
  const systemRef = facts.reference
    ?? (c.case_number == null ? '' : `PLP/${new Date(c.created_at).getFullYear()}/${String(c.case_number).padStart(6, '0')}`)
  const paidOn = c.paid_at ? lagosToday(new Date(c.paid_at)) : today
  const tier = c.delivery_option === 'pandas-serves'
    ? ', Pandas LP serves'
    : c.delivery_option === 'self-serve' ? ', self-service' : ''
  const fee = c.amount_paid
    ? `Paid ₦${c.amount_paid.toLocaleString('en-NG')}${tier} on ${paidOn}.`
    : `Marked paid on ${paidOn}.`
  const actionItem = c.status === 'judgment_obtained'
    ? 'Review judgment enforcement options.'
    : c.status === 'filed'
      ? 'Monitor the court proceedings.'
      : c.status === 'letter_served'
        ? 'Follow up on the demand letter.'
        : 'Review, sign and serve the letter of demand.'

  return {
    caseId: c.id,
    fileNumber: null,
    systemRef,
    matter: matterName(c.document_title, facts.client || null, facts.debtor || null),
    client: facts.client,
    contact: [c.client_phone, c.client_email, c.userEmail].filter(Boolean).join(' · '),
    amountOwed: nairaFigure(facts.amountLine),
    status: c.status === 'closed' ? 'Cleared' : 'Outstanding',
    actionItem,
    discussion: `${fee} Letter of demand drafted.${systemRef ? ` Our Ref ${systemRef}.` : ''}`,
    dateOpened: lagosToday(new Date(c.created_at)),
    lastUpdated: today,
  }
}
