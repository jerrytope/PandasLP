export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { activeMarketingContacts, csvCell, normaliseEmail, type ConsentRecordRow } from '@/lib/consent'
import { recordConsent, unsubscribeUrl } from '@/lib/consentServer'
import { normaliseNgPhone } from '@/lib/debtCheck'
import { isValidEmail } from '@/lib/invoices'

const COLUMNS = 'id, created_at, email, phone, purpose, granted, channels, wording, wording_version, source, source_id, recorded_by, note'

async function allRecords(): Promise<ConsentRecordRow[]> {
  const out: ConsentRecordRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from('consent_records').select(COLUMNS).order('created_at', { ascending: true }).range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data || []) as ConsentRecordRow[]))
    if (!data || data.length < 1000) return out
  }
}

// GET               { records, active }  every consent record and who may be marketed to now
// GET ?format=csv   the current marketing list as a spreadsheet, with an unsubscribe link each
export async function GET(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  let records: ConsentRecordRow[]
  try {
    records = await allRecords()
  } catch (err) {
    return Response.json({ error: `Could not load consent records. (${err instanceof Error ? err.message : 'unknown'})` }, { status: 500 })
  }
  const active = activeMarketingContacts(records)

  if (new URL(req.url).searchParams.get('format') === 'csv') {
    const header = ['Email', 'Phone', 'Channels', 'Opted in (UTC)', 'Where', 'Wording version', 'Unsubscribe link']
    const lines = [
      header.map(csvCell).join(','),
      ...active.map((c) =>
        [c.email, c.phone, c.channels.join(' '), c.since.replace('T', ' ').slice(0, 19), c.source, c.wording_version, unsubscribeUrl(c)].map(csvCell).join(','),
      ),
    ]
    return new Response('\uFEFF' + lines.join('\r\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="pandas-lp-marketing-list-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
      },
    })
  }
  return Response.json({ records, active })
}

// POST { email?, phone?, granted, note }  staff record a marketing choice given to them directly
// (e.g. "STOP" on WhatsApp, or a yes on a call). An opt-in needs a note saying how it was given.
export async function POST(req: Request) {
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult
  let body: { email?: string | null; phone?: string | null; granted?: boolean; note?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const email = normaliseEmail(body.email)
  if (email && !isValidEmail(email)) return Response.json({ error: 'That email address doesn’t look right.' }, { status: 400 })
  const phone = body.phone ? normaliseNgPhone(body.phone) : null
  if (body.phone && !phone) return Response.json({ error: 'That phone number doesn’t look right.' }, { status: 400 })
  if (!email && !phone) return Response.json({ error: 'Add an email or phone number.' }, { status: 400 })
  if (typeof body.granted !== 'boolean') return Response.json({ error: 'Say whether this is an opt-in or an opt-out.' }, { status: 400 })
  const note = body.note?.trim() ?? ''
  if (body.granted && note.length < 5) return Response.json({ error: 'Say how and when they agreed, e.g. “Said yes on a call, 27 Sep”.' }, { status: 400 })

  const result = await recordConsent({
    email,
    phone,
    purpose: 'marketing',
    granted: body.granted,
    source: 'admin',
    recordedBy: authResult.user.email ?? 'unknown',
    note: note || null,
  })
  if ('error' in result) return Response.json({ error: `Could not record it. (${result.error})` }, { status: 500 })
  return Response.json({ ok: true })
}
