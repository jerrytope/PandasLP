export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const RATE_LIMIT = 60
const RATE_WINDOW_MS = 5 * 60 * 1000

export async function GET(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-cases:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const statusFilter = url.searchParams.get('status')
  const agentFilter = url.searchParams.get('agentId')
  const emailFilter = url.searchParams.get('email')?.trim().toLowerCase()
  // 'live' (default) hides cases someone flagged as just a test run of an agent, so they
  // don't get counted alongside real clients anywhere — the Queue tab and the Cases tab's
  // default view both rely on this default. 'test' shows only flagged cases; 'all' shows both.
  const testFilter = url.searchParams.get('testFilter') || 'live'

  // "paid_plus" isn't a real status — it's the post-launch default view (staff want real,
  // transacted customers by default, not every abandoned/incomplete interview), so it expands
  // to every stage from first payment onward rather than matching a single column value.
  const PAID_PLUS_STATUSES = ['paid', 'letter_served', 'filed', 'judgment_obtained', 'closed']

  let query = supabaseAdmin.from('cases').select('*').order('created_at', { ascending: false })
  if (statusFilter === 'paid_plus') query = query.in('status', PAID_PLUS_STATUSES)
  else if (statusFilter) query = query.eq('status', statusFilter)
  if (agentFilter) query = query.eq('agent_id', agentFilter)
  if (testFilter === 'live') query = query.eq('is_test', false)
  else if (testFilter === 'test') query = query.eq('is_test', true)

  const { data: cases, error: casesErr } = await query
  if (casesErr) {
    return Response.json({ error: 'Failed to load cases.' }, { status: 500 })
  }

  // cases.user_id is an auth.users id, not an email — resolve emails for just the users
  // actually present in this page of cases, in parallel, rather than either N+1 sequential
  // lookups or a listUsers() scan (which silently truncates past 1000 total auth users).
  const uniqueUserIds = [...new Set((cases ?? []).map((c) => c.user_id))]
  const emailById = new Map<string, string>()
  const userLookups = await Promise.all(
    uniqueUserIds.map((id) => supabaseAdmin.auth.admin.getUserById(id)),
  )
  for (const { data } of userLookups) {
    if (data?.user) emailById.set(data.user.id, data.user.email ?? '')
  }

  // Whether a staff-uploaded, reviewed-and-stamped PDF actually exists in storage for this
  // case — see app/api/admin/upload-reviewed-document/route.ts's own comment for why that's
  // deliberately NOT a `cases` column (a "does an object exist" flag duplicated into a column
  // is exactly the kind of state that can drift out of sync with the object itself). One list
  // call for the whole "reviewed/" prefix, not one per case — Serve via WhatsApp
  // (app/admin/page.tsx) requires this before it'll let staff serve the debtor at all, so it
  // has to be correct for every case on the page, not just the one currently open.
  const { data: reviewedFiles } = await supabaseAdmin.storage.from('case-documents').list('reviewed', { limit: 1000 })
  const stampedCaseIds = new Set((reviewedFiles ?? []).map((f) => f.name.replace(/\.pdf$/, '')))

  let enriched = (cases ?? []).map((c) => ({
    ...c,
    userEmail: emailById.get(c.user_id) ?? '',
    hasStampedDocument: stampedCaseIds.has(c.id),
  }))

  if (emailFilter) {
    enriched = enriched.filter((c) => c.userEmail.toLowerCase().includes(emailFilter))
  }

  return Response.json({ cases: enriched, total: enriched.length })
}

export async function DELETE(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-cases-delete:${getClientIp(req)}`, 20, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const url = new URL(req.url)
  const caseId = url.searchParams.get('caseId')?.trim()
  if (!caseId) {
    return Response.json({ error: 'Missing caseId query parameter.' }, { status: 400 })
  }

  // Verify the case exists before attempting delete so we can return a meaningful 404.
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .single()

  if (fetchErr || !existing) {
    return Response.json({ error: 'Case not found.' }, { status: 404 })
  }

  // Hard-delete — ON DELETE CASCADE on messages.case_id and case_status_history.case_id
  // means related rows are automatically removed by Postgres. No orphan risk.
  const { error: deleteErr } = await supabaseAdmin
    .from('cases')
    .delete()
    .eq('id', caseId)

  if (deleteErr) {
    return Response.json({ error: 'Failed to delete case.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}

// Toggles the is_test flag, or records an independent second reviewer's confirmation.
// Anything to do with case *status* goes through app/api/update-case-status/route.ts's
// stricter transition rules; this route is for staff-visibility/audit fields that don't move
// the case through its status lifecycle.
export async function PATCH(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-cases-patch:${getClientIp(req)}`, 60, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }

  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  let body: {
    caseId?: string
    isTest?: boolean
    secondReviewerEmail?: string
    clientEmail?: string
    recipientPhone?: string
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { caseId, isTest, secondReviewerEmail, clientEmail, recipientPhone } = body
  if (!caseId) {
    return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  }
  if (typeof isTest !== 'boolean' && !secondReviewerEmail && clientEmail === undefined && recipientPhone === undefined) {
    return Response.json({ error: 'Missing isTest, secondReviewerEmail, clientEmail, or recipientPhone.' }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (typeof isTest === 'boolean') update.is_test = isTest
  // Recommended, not enforced — see lib/reviewChecklists.ts's isHighRiskDocument(). A solo
  // reviewer can still mark a case reviewed without this; it's a recorded confirmation for
  // when a second lawyer is actually available to look at the four highest-risk document types.
  if (secondReviewerEmail) {
    update.second_reviewer_email = secondReviewerEmail
    update.second_reviewed_at = new Date().toISOString()
  }
  // Corrects or sets the address sendCaseEmail actually mails to — see its own preference for
  // client_email over the case owner's auth email (lawyer-intake cases have no client account
  // at all — see lib/agents.ts's SMALL_CLAIMS_LAWYER_INTAKE_PROMPT — but any case can have a
  // wrong or outdated signup address corrected here too). An empty string clears it back to
  // "use the account email", which is a real, valid state, so this checks for `undefined`
  // specifically rather than falsiness — the trimmed clientEmail !== undefined check above
  // already let an intentional '' through.
  if (clientEmail !== undefined) {
    update.client_email = clientEmail.trim() || null
  }
  // The debtor's/tenant's phone — who "Serve via WhatsApp" (app/admin/page.tsx) actually
  // serves. Never client_phone, a different person's number entirely — see recipient_phone's
  // own comment in supabase-schema.sql. Same undefined-vs-falsy handling as clientEmail above:
  // an explicit empty string is a real "clear it" action, not a missing field.
  if (recipientPhone !== undefined) {
    update.recipient_phone = recipientPhone.trim() || null
  }

  const { error: updateErr } = await supabaseAdmin.from('cases').update(update).eq('id', caseId)
  if (updateErr) {
    return Response.json({ error: 'Failed to update case.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
