export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { buildServiceMessage, buildNegotiationReplyMessage, buildWhatsAppLink, hashMessage, generateAccessToken } from '@/lib/whatsappService'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 5 * 60 * 1000

// Dispatch a new WhatsApp service attempt for a case — records it as evidence (see
// supabase-schema.sql's service_records table) rather than pretending the record itself is a
// sworn affidavit. Returns the wa.me link for the admin UI to open; recording the dispatch and
// opening WhatsApp are two separate client-side steps, this route only does the former.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-service-records:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { caseId?: string; phone?: string; negotiationId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { caseId, phone, negotiationId } = body
  if (!caseId || !phone) {
    return Response.json({ error: 'Missing caseId or phone.' }, { status: 400 })
  }

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .select('id, case_number, created_at, document_title')
    .eq('id', caseId)
    .single()
  if (caseErr || !caseData) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }
  if (!caseData.document_title) {
    return Response.json({ error: 'This case has no document to serve yet.' }, { status: 400 })
  }

  // Serving a specific negotiation reply rather than the case's original document — confirm
  // the round actually exists, belongs to this case, is our side of the thread, and has a
  // stamped attachment before dispatching. Staff should never be able to serve a reply with
  // nothing behind it, or one that belongs to a different case entirely.
  if (negotiationId) {
    const { data: round, error: roundErr } = await supabaseAdmin
      .from('case_negotiations')
      .select('id, party, attachment_path')
      .eq('id', negotiationId)
      .eq('case_id', caseId)
      .single()
    if (roundErr || !round) {
      return Response.json({ error: 'Negotiation entry not found.' }, { status: 404 })
    }
    if (round.party !== 'pandas_lp') {
      return Response.json({ error: 'Only our own reply can be served — not a counter we received.' }, { status: 400 })
    }
    if (!round.attachment_path) {
      return Response.json({ error: 'Attach the stamped reply before serving it.' }, { status: 409 })
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const year = new Date(caseData.created_at).getFullYear()
  const caseRef = caseData.case_number != null ? `PLP/${year}/${String(caseData.case_number).padStart(6, '0')}` : `PLP/${year}/PENDING`

  const accessToken = generateAccessToken()
  const serveUrl = `${siteUrl}/serve/${accessToken}`
  const messageBuilder = negotiationId ? buildNegotiationReplyMessage : buildServiceMessage
  const message = messageBuilder({ caseRef, documentTitle: caseData.document_title, serveUrl })
  const waLink = buildWhatsAppLink(phone, message)

  const { error: insertErr } = await supabaseAdmin.from('service_records').insert({
    case_id: caseId,
    channel: 'whatsapp',
    recipient_phone: phone,
    message_text: message,
    message_hash: hashMessage(message),
    access_token: accessToken,
    status: 'dispatched',
    negotiation_id: negotiationId || null,
  })
  if (insertErr) {
    console.error('Failed to record service dispatch:', insertErr)
    return Response.json({ error: 'Failed to record this service attempt.' }, { status: 500 })
  }

  return Response.json({ ok: true, whatsappLink: waLink, serveUrl })
}

export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-service-records-get:${getClientIp(req)}`, 60, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const caseId = url.searchParams.get('caseId')
  if (!caseId) {
    return Response.json({ error: 'Missing caseId query parameter.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('service_records')
    .select('id, channel, recipient_phone, status, dispatched_at, link_opened_at, acknowledged_at, acknowledged_by')
    .eq('case_id', caseId)
    .order('dispatched_at', { ascending: false })
  if (error) {
    return Response.json({ error: 'Failed to load service records.' }, { status: 500 })
  }

  return Response.json({ records: data ?? [] })
}

// Manual-only transition — "acknowledged" means a staff member has actual, real-world
// knowledge the recipient engaged (replied, called, showed up), not something the system can
// detect on its own. "dispatched" and "link_opened" are set automatically elsewhere and are
// not reachable through this endpoint.
export async function PATCH(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-service-records-patch:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: { recordId?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { recordId } = body
  if (!recordId) {
    return Response.json({ error: 'Missing recordId.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('service_records')
    .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), acknowledged_by: authResult.user.email })
    .eq('id', recordId)
  if (error) {
    return Response.json({ error: 'Failed to update this service record.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
