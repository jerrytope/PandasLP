export const runtime = 'nodejs'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { getReceiptDate } from '@/lib/debtorReminders'
import { filingStatus } from '@/lib/readyToFile'
import { lagosToday } from '@/lib/negotiationStatus'
import type { FilingRow } from '@/lib/courtFiling'

// The ready-to-file queue: every served debt case whose fourteen days have run out (or will
// within three days) and which has not been filed, with what still blocks filing.
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth

  const { data: cases, error } = await supabaseAdmin
    .from('cases')
    .select('*')
    .eq('status', 'letter_served')
    .eq('is_test', false)
    .eq('agent_id', 'small-claims')
  if (error) return Response.json({ error: 'Could not load the cases.' }, { status: 500 })
  if (!cases?.length) return Response.json({ items: [] })

  const ids = cases.map((c) => c.id)
  const [{ data: records }, { data: filings }] = await Promise.all([
    supabaseAdmin.from('service_records').select('case_id, dispatched_at, link_opened_at, acknowledged_at, negotiation_id').in('case_id', ids),
    supabaseAdmin.from('court_filings').select('*').in('case_id', ids),
  ])
  const filingIds = (filings ?? []).map((f) => f.id)
  const { data: docs } = filingIds.length
    ? await supabaseAdmin.from('court_filing_documents').select('filing_id, kind').in('filing_id', filingIds)
    : { data: [] as { filing_id: string; kind: string }[] }

  const today = lagosToday()
  const items = []
  for (const c of cases) {
    const filing = (filings ?? []).find((f) => f.case_id === c.id) ?? null
    if (filing?.filed_at) continue
    const receipt = getReceiptDate({
      enteredDate: c.letter_received_on ?? null,
      deadlineAt: c.deadline_at ?? null,
      serviceRecords: (records ?? []).filter((r) => r.case_id === c.id),
    })
    if (!receipt) continue
    const status = filingStatus({
      received: receipt.date,
      filing: filing as FilingRow | null,
      docKinds: (docs ?? []).filter((d) => d.filing_id === filing?.id).map((d) => d.kind),
      today,
    })
    if (status.daysSinceLapse < -3) continue
    items.push({
      caseId: c.id,
      caseNumber: c.case_number,
      title: c.document_title,
      state: filing?.state ?? null,
      received: receipt.date,
      ...status,
    })
  }
  items.sort((a, b) => b.daysSinceLapse - a.daysSinceLapse)
  return Response.json({ items })
}
