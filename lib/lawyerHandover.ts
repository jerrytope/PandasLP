import { createHash } from 'node:crypto'
import { GMAIL_USER, isMailerConfigured, sendMail } from './mailer'
import { supabaseAdmin } from './supabaseAdmin'

export type HandoverKind = 'legal_question' | 'lawyer_review' | 'client_request'

export interface HandoverRequest {
  kind: HandoverKind
  summary: string
  contactPreference?: string
  contactDetail?: string
}

export function conversationKey(caseId: string | null, agentId: string, firstUserMessage: string) {
  if (caseId) return `case:${caseId}`
  const digest = createHash('sha256').update(firstUserMessage).digest('hex').slice(0, 24)
  return `chat:${agentId}:${digest}`
}

export function parseHandoverBlock(text: string): { response: string; handover: HandoverRequest | null } {
  const match = text.match(/<<<HANDOVER>>>\s*([\s\S]*?)\s*<<<END_HANDOVER>>>/)
  if (!match) return { response: text, handover: null }
  const response = text.replace(match[0], '').trim()
  try {
    const value = JSON.parse(match[1]) as Record<string, unknown>
    if (
      (value.kind !== 'legal_question' && value.kind !== 'lawyer_review' && value.kind !== 'client_request') ||
      typeof value.summary !== 'string' ||
      !value.summary.trim()
    ) return { response, handover: null }
    return {
      response: response || 'I have referred this to a member of the legal team for follow-up.',
      handover: {
        kind: value.kind,
        summary: value.summary.trim().slice(0, 2000),
        contactPreference: typeof value.contactPreference === 'string' ? value.contactPreference.slice(0, 80) : undefined,
        contactDetail: typeof value.contactDetail === 'string' ? value.contactDetail.slice(0, 200) : undefined,
      },
    }
  } catch {
    return { response, handover: null }
  }
}

export async function saveLawyerHandover(input: {
  handover: HandoverRequest
  caseId: string | null
  agentId: string
  conversationKey: string
  clientEmail: string | null
  clientPhone: string | null
}) {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: lookupError } = await supabaseAdmin
    .from('lawyer_handovers')
    .select('id')
    .eq('conversation_key', input.conversationKey)
    .eq('kind', input.handover.kind)
    .eq('status', 'open')
    .gte('created_at', since)
    .limit(1)
  if (lookupError) throw lookupError
  if (recent?.length) return { duplicate: true }

  const { data, error } = await supabaseAdmin
    .from('lawyer_handovers')
    .insert({
      case_id: input.caseId,
      conversation_key: input.conversationKey,
      agent_id: input.agentId,
      kind: input.handover.kind,
      summary: input.handover.summary,
      contact_preference: input.handover.contactPreference ?? null,
      contact_detail: input.handover.contactDetail ?? null,
      client_email: input.clientEmail,
      client_phone: input.clientPhone,
    })
    .select('id')
    .single()
  if (error) throw error

  if (isMailerConfigured()) {
    const recipient = (process.env.ADMIN_EMAILS ?? process.env.ADMIN_EMAIL ?? GMAIL_USER).split(',').map((email) => email.trim()).filter(Boolean).join(', ')
    const text = [
      `Kind: ${input.handover.kind}`,
      `Summary: ${input.handover.summary}`,
      `Contact preference: ${input.handover.contactPreference ?? 'not provided'}`,
      `Contact detail: ${input.handover.contactDetail ?? 'not provided'}`,
      `Client email: ${input.clientEmail ?? 'not available'}`,
      `Client phone: ${input.clientPhone ?? 'not available'}`,
      `Case: ${input.caseId ?? 'no associated case'}`,
      `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pandaslp.com.ng'}/admin?section=queue`,
    ].join('\n')
    try {
      await sendMail({
        to: recipient,
        subject: `Lawyer handover: ${input.handover.kind.replaceAll('_', ' ')} | Pandas LP`,
        text,
        html: `<pre style="font-family:inherit;white-space:pre-wrap">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
      })
    } catch (error) {
      console.error('Lawyer handover saved but staff notification failed:', error)
    }
  }
  return { duplicate: false, id: data.id }
}
