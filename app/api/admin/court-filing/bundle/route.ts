export const runtime = 'nodejs'
export const maxDuration = 60

import JSZip from 'jszip'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/adminAuth'
import { packKinds, rulesFor, type FilingRow } from '@/lib/courtFiling'
import { buildCourtPackPdfBuffer } from '@/lib/courtFormPdf.js'
import { buildTextDocumentBuffer } from '@/lib/pdfGenerator.js'
import { EVIDENCE_BUCKET } from '@/lib/evidence'
import { getReceiptDate } from '@/lib/debtorReminders'
import { filingStatus, filingDayChecklist } from '@/lib/readyToFile'
import { lagosToday } from '@/lib/negotiationStatus'

// Everything needed at the registry, in one download: the filing pack in bundle order, the
// letter of demand as served, every evidence file numbered, and the filing-day checklist.
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if (auth instanceof Response) return auth
  const caseId = new URL(req.url).searchParams.get('caseId')
  if (!caseId) return Response.json({ error: 'Missing caseId.' }, { status: 400 })

  const { data: c } = await supabaseAdmin.from('cases').select('*').eq('id', caseId).maybeSingle()
  if (!c) return Response.json({ error: 'Case not found.' }, { status: 404 })
  const { data: filing } = await supabaseAdmin.from('court_filings').select('*').eq('case_id', caseId).maybeSingle()
  if (!filing) return Response.json({ error: 'Start the filing in the Court filing tab first.' }, { status: 400 })

  const { data: docs } = await supabaseAdmin
    .from('court_filing_documents')
    .select('kind, title, body, created_at')
    .eq('filing_id', filing.id)
    .order('created_at', { ascending: false })
  const latest = packKinds(filing.state)
    .map((k) => (docs ?? []).find((d) => d.kind === k))
    .filter((d): d is { kind: string; title: string; body: string; created_at: string } => Boolean(d))

  const zip = new JSZip()
  const n = c.case_number ?? 'case'
  if (latest.length) zip.file(`1 Filing pack (case ${n}).pdf`, buildCourtPackPdfBuffer(latest.map((d) => d.body)))

  // The letter as served: the stamped copy if one was uploaded, otherwise rendered from the case.
  const { data: stamped } = await supabaseAdmin.storage.from('case-documents').download(`reviewed/${caseId}.pdf`)
  if (stamped) zip.file('2 Letter of demand as served.pdf', Buffer.from(await stamped.arrayBuffer()))
  else if (c.document_body) zip.file('2 Letter of demand as served.pdf', buildTextDocumentBuffer(c.document_title ?? 'Letter of demand', c.document_body, { watermark: false }))

  const { data: evidence } = await supabaseAdmin
    .from('case_evidence')
    .select('filename, storage_path, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
  const folder = zip.folder('3 Evidence')
  let i = 0
  for (const e of evidence ?? []) {
    const { data: file } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).download(e.storage_path)
    if (!file) continue
    i += 1
    folder?.file(`${String(i).padStart(2, '0')} ${e.filename.replace(/[\\/:*?"<>|]+/g, '-')}`, Buffer.from(await file.arrayBuffer()))
  }

  const { data: records } = await supabaseAdmin.from('service_records').select('dispatched_at, link_opened_at, negotiation_id').eq('case_id', caseId)
  const receipt = getReceiptDate({
    enteredDate: c.letter_received_on ?? null,
    deadlineAt: c.deadline_at ?? null,
    serviceRecords: records ?? [],
  })
  const status = filingStatus({
    received: receipt?.date ?? lagosToday(),
    filing: filing as FilingRow,
    docKinds: (docs ?? []).map((d) => d.kind),
    today: lagosToday(),
  })
  zip.file('0 Filing-day checklist.txt', filingDayChecklist(rulesFor(filing.state).name, status))

  const body = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="filing-bundle-case-${n}.zip"`,
    },
  })
}
