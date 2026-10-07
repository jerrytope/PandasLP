export const runtime = 'nodejs'

import { requireAdmin } from '@/lib/adminAuth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isMailerConfigured, sendMail } from '@/lib/mailer'
import { brandWorkspaceOrNull, loadServedPdf, serveBrandCaseByEmail } from '@/lib/brandServing'

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 5 * 60 * 1000

// "Serve borrower by email": emails the approved, stamped letter to a brand's borrower, copying
// the brand, then marks the matter served. All the checks live in serveBrandCaseByEmail.
export async function POST(req: Request) {
  const { allowed, retryAfterSeconds } = checkRateLimit(`admin-brand-serve:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return Response.json(
      { error: 'Too many requests — please wait a moment before trying again.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }
  const authResult = await requireAdmin(req)
  if (authResult instanceof Response) return authResult

  const body = (await req.json().catch(() => ({}))) as { caseId?: string }
  if (!body.caseId) return Response.json({ error: 'Missing caseId.' }, { status: 400 })
  if (!isMailerConfigured()) return Response.json({ error: 'Email isn’t set up (GMAIL_APP_PASSWORD), so nothing was sent.' }, { status: 503 })

  const result = await serveBrandCaseByEmail(body.caseId, authResult.user.email ?? 'staff', {
    mail: sendMail,
    now: () => new Date(),
    workspace: brandWorkspaceOrNull(),
    loadServedPdf,
  })
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status })
  return Response.json({ ok: true, servedAt: result.servedAt })
}
