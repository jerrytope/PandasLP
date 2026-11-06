export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { buildWhatsAppLink } from '@/lib/whatsappService'
import {
  buildDebtorReminderMessage,
  DEBTOR_REMINDERS,
  getReceiptDate,
  reminderRows,
  type DebtorReminderKey,
  type DebtorReminderRecord,
} from '@/lib/debtorReminders'

const SETUP_MESSAGE = 'Run add-debtor-reminders.sql in the Supabase SQL editor before using debtor reminders.'

function isSetupError(error: { code?: string; message?: string }) {
  return error.code === '42P01' || error.code === 'PGRST205' || /letter_received_on/.test(error.message)
}

async function loadReminderCase(caseId: string) {
  const { data: caseRow, error } = await supabaseAdmin
    .from('cases')
    .select('id, status, case_number, created_at, document_title, document_body, deadline_at, recipient_phone, client_email, letter_received_on')
    .eq('id', caseId)
    .maybeSingle()
  if (error) return { error, response: Response.json({ error: isSetupError(error) ? SETUP_MESSAGE : 'Could not load the case.' }, { status: isSetupError(error) ? 503 : 500 }) }
  if (!caseRow) return { response: Response.json({ error: 'Case not found.' }, { status: 404 }) }
  return { caseRow }
}

function caseReference(caseRow: { case_number: number | null; created_at: string }) {
  const year = new Date(caseRow.created_at).getFullYear()
  return caseRow.case_number == null ? `PLP/${year}/PENDING` : `PLP/${year}/${String(caseRow.case_number).padStart(6, '0')}`
}

export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-debtor-reminders:${getClientIp(req)}`, 60, 5 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth

  const caseId = new URL(req.url).searchParams.get('caseId')
  if (!caseId) return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  const loaded = await loadReminderCase(caseId)
  if (!loaded.caseRow) return loaded.response
  const c = loaded.caseRow

  const [{ data: serviceRecords, error: serviceError }, { data: reminders, error: reminderError }] = await Promise.all([
    supabaseAdmin.from('service_records').select('dispatched_at, link_opened_at, acknowledged_at, negotiation_id').eq('case_id', caseId),
    supabaseAdmin.from('case_debtor_reminders')    .select('reminder_key, status, prepared_at, sent_at, sent_by, channel, message').eq('case_id', caseId),
  ])
  if (serviceError) return Response.json({ error: 'Could not load service history for reminders.' }, { status: 500 })
  if (reminderError) return Response.json({ error: isSetupError(reminderError) ? SETUP_MESSAGE : 'Could not load reminder history.' }, { status: isSetupError(reminderError) ? 503 : 500 })

  const receipt = getReceiptDate({ enteredDate: c.letter_received_on, deadlineAt: c.deadline_at, serviceRecords: serviceRecords ?? [] })
  const sent = (reminders ?? []) as DebtorReminderRecord[]
  const rows = receipt
    ? reminderRows(receipt.date, sent).map((row) => ({
        ...row,
        message: row.record?.message ?? buildDebtorReminderMessage({
          key: row.key,
          received: receipt.date,
          caseReference: caseReference(c),
          debtorName: null,
          clientName: null,
          documentTitle: c.document_title,
        }),
      }))
    : []
  return Response.json({
    receipt,
    deadline: receipt ? new Date(new Date(`${receipt.date}T00:00:00Z`).getTime() + 14 * 86_400_000).toISOString().slice(0, 10) : null,
    rows,
    phone: c.recipient_phone,
    status: c.status,
  })
}

export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-debtor-reminders-post:${getClientIp(req)}`, 20, 5 * 60 * 1000)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } })
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  let body: { caseId?: string; key?: string; channel?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.caseId || !DEBTOR_REMINDERS.some((item) => item.key === body.key) || typeof body.message !== 'string' || !body.message.trim()) {
    return Response.json({ error: 'Missing caseId, reminder key, or message.' }, { status: 400 })
  }
  if (body.message.length > 5000) return Response.json({ error: 'The message is too long.' }, { status: 400 })
  const loaded = await loadReminderCase(body.caseId)
  if (!loaded.caseRow) return loaded.response
  if (loaded.caseRow.status !== 'letter_served') return Response.json({ error: 'Debtor reminders are available only after the demand letter is marked served.' }, { status: 409 })
  const channel = body.channel === 'whatsapp' ? 'whatsapp' : 'other'
  if (channel === 'whatsapp' && !loaded.caseRow.recipient_phone) return Response.json({ error: 'Add the debtor phone number before using WhatsApp.' }, { status: 400 })

  const key = body.key as DebtorReminderKey
  const { error } = await supabaseAdmin.from('case_debtor_reminders').insert({
    case_id: body.caseId,
    reminder_key: key,
    channel,
    message: body.message.trim(),
    sent_by: auth.user.email ?? null,
  })
  if (error) {
    if (error.code === '23505') return Response.json({ error: 'This reminder has already been recorded.' }, { status: 409 })
    return Response.json({ error: isSetupError(error) ? SETUP_MESSAGE : 'Could not record the reminder.' }, { status: isSetupError(error) ? 503 : 500 })
  }
  return Response.json({
    ok: true,
    whatsappLink: channel === 'whatsapp' ? buildWhatsAppLink(loaded.caseRow.recipient_phone as string, body.message.trim()) : null,
  })
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  let body: { caseId?: string; receivedOn?: string | null; reminderKey?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!body.caseId) return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  if (body.reminderKey) {
    if (!DEBTOR_REMINDERS.some((item) => item.key === body.reminderKey)) return Response.json({ error: 'Unknown reminder.' }, { status: 400 })
    const { data, error } = await supabaseAdmin
      .from('case_debtor_reminders')
      .update({ status: 'sent', sent_at: new Date().toISOString(), sent_by: auth.user.email ?? null })
      .eq('case_id', body.caseId)
      .eq('reminder_key', body.reminderKey)
      .eq('status', 'prepared')
      .select('reminder_key')
    if (error) return Response.json({ error: isSetupError(error) ? SETUP_MESSAGE : 'Could not confirm the reminder was sent.' }, { status: isSetupError(error) ? 503 : 500 })
    if (!data?.length) return Response.json({ error: 'No prepared reminder was found, or it was already confirmed as sent.' }, { status: 409 })
    return Response.json({ ok: true })
  }
  const receivedOn = body.receivedOn ?? null
  if (receivedOn !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn) || Number.isNaN(Date.parse(`${receivedOn}T00:00:00Z`)))) {
    return Response.json({ error: 'Use a valid date in YYYY-MM-DD format.' }, { status: 400 })
  }
  const loaded = await loadReminderCase(body.caseId)
  if (!loaded.caseRow) return loaded.response
  if (loaded.caseRow.status !== 'letter_served') return Response.json({ error: 'Record service before setting the debtor receipt date.' }, { status: 409 })
  const { error } = await supabaseAdmin.from('cases').update({ letter_received_on: receivedOn }).eq('id', body.caseId)
  if (error) return Response.json({ error: isSetupError(error) ? SETUP_MESSAGE : 'Could not save the receipt date.' }, { status: isSetupError(error) ? 503 : 500 })
  return Response.json({ ok: true })
}
