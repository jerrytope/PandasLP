import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { renderFormattedText } from '@/lib/renderFormattedText'
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
    .select('id, case_id, status, negotiation_id')
    .eq('access_token', token)
    .single()

  if (recordErr || !record) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF8', color: '#1A1A1A', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Link not found</h1>
          <p style={{ color: '#6B6B6B', fontSize: 14 }}>This link is invalid or has expired. Contact pandaslegalpractitioners@gmail.com if you believe this is an error.</p>
        </div>
      </div>
    )
  }

  const { data: caseData } = await supabaseAdmin
    .from('cases')
    .select('document_title, document_body')
    .eq('id', record.case_id)
    .single()

  // A reply logged in NegotiationPanel.tsx, not the case's original document — see
  // supabase-schema.sql's service_records.negotiation_id comment. Reuses this same page and
  // token mechanism rather than a second serve system; only the body and heading differ.
  const negotiationReply = record.negotiation_id
    ? (await supabaseAdmin.from('case_negotiations').select('summary').eq('id', record.negotiation_id).single()).data
    : null

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

  const bodyText = negotiationReply?.summary ?? caseData?.document_body
  if (!bodyText) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAFAF8', color: '#1A1A1A', padding: 24 }}>
        <p style={{ color: '#6B6B6B', fontSize: 14 }}>This document is not yet available. Contact pandaslegalpractitioners@gmail.com.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', color: '#1A1A1A', padding: '64px 20px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.15em', color: '#B8860B', textTransform: 'uppercase', marginBottom: 16 }}>
          {negotiationReply ? 'Pandas LP — Reply on Your Matter' : 'Pandas LP — Notice of Service'}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28, lineHeight: 1.3 }}>
          {negotiationReply ? `Re: ${caseData?.document_title ?? 'Your Matter'}` : caseData?.document_title}
        </h1>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 8, padding: '32px 28px', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {renderFormattedText(bodyText)}
        </div>
        <p style={{ marginTop: 28, fontSize: 12, color: '#6B6B6B' }}>
          Pandas LP — Licensed Legal Practitioners, Lagos, Nigeria — CAC BN 9646741<br />
          pandaslegalpractitioners@gmail.com · +234 811 808 0189
        </p>
      </div>
    </div>
  )
}
