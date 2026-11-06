import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CASE_DOCUMENT_BUCKET } from '@/lib/reviewedDocuments'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Public, unauthenticated by design — this is the link a debtor/counterparty (who has no
// Pandas LP account) clicks from a WhatsApp service message. Looked up ONLY by the random
// access_token (see lib/whatsappService.ts's generateAccessToken), never by case_id, so a
// leaked link exposes exactly the one document it was generated for and nothing else — no
// other case data, no client PII beyond what's already inside that document's own text.
export default async function ServePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: record, error: recordErr } = await supabaseAdmin
    .from('service_records')
    .select('id, case_id, status, negotiation_id, document_path')
    .eq('access_token', token)
    .single()

  if (recordErr || !record) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', color: 'var(--text-1)', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Link not found</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>This link is invalid or has expired. Contact pandaslegalpractitioners@gmail.com if you believe this is an error.</p>
        </div>
      </div>
    )
  }

  const { data: caseData, error: caseError } = await supabaseAdmin
    .from('cases')
    .select('document_title')
    .eq('id', record.case_id)
    .single()
  const { data: signed, error: signedError } = record.document_path
    ? await supabaseAdmin.storage.from(CASE_DOCUMENT_BUCKET).createSignedUrl(record.document_path, 60 * 60, { download: `${caseData?.document_title ?? 'Legal document'}.pdf` })
    : { data: null, error: new Error('No stamped PDF was attached to this service record.') }

  // Only ever moves 'dispatched' -> 'link_opened' — never overwrites 'acknowledged', and
  // never re-fires link_opened_at on a repeat visit (real first-view timestamp, not "last
  // visit"). Best-effort: a failed update here must never block the recipient from seeing
  // the actual document they were served.
  if (record.status === 'dispatched') {
    await supabaseAdmin
      .from('service_records')
      .update({ status: 'link_opened', link_opened_at: new Date().toISOString() })
      .eq('id', record.id)
      .then(({ error }) => {
        if (error) console.error('Failed to record link_opened:', error)
      })
  }

  if (caseError || signedError || !signed?.signedUrl) {
    if (caseError) console.error('Could not load served case title:', caseError)
    if (signedError) console.error('Could not sign the served PDF URL:', signedError)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', color: 'var(--text-1)', padding: 24 }}>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>This document is not yet available. Contact pandaslegalpractitioners@gmail.com.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-1)', padding: '64px 20px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.15em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 16 }}>
          {record.negotiation_id ? 'Pandas LP — Reply on Your Matter' : 'Pandas LP — Notice of Service'}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28, lineHeight: 1.3 }}>
          {record.negotiation_id ? `Re: ${caseData?.document_title ?? 'Your Matter'}` : caseData?.document_title}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 14 }}>
          The reviewed, signed and stamped PDF is ready to view or download.
        </p>
        <a href={signed.signedUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '12px 18px', borderRadius: 6, background: 'var(--accent)', color: 'white', fontWeight: 600, textDecoration: 'none' }}>
          Open or download the PDF
        </a>
        <iframe title="Reviewed and stamped legal document" src={signed.signedUrl} style={{ display: 'block', width: '100%', height: '75vh', marginTop: 24, border: '1px solid #E8E4DF', borderRadius: 8, background: 'white' }} />
        <p style={{ marginTop: 28, fontSize: 12, color: 'var(--text-2)' }}>
          Pandas LP — Licensed Legal Practitioners, Lagos, Nigeria — CAC BN 9646741<br />
          pandaslegalpractitioners@gmail.com · +234 811 808 0189
        </p>
      </div>
    </div>
  )
}
