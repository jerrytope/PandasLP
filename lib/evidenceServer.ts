// Server-only helpers for client evidence: confirming an uploaded file is really in the bucket,
// and telling the firm when new evidence arrives. See lib/evidence.ts for the overall flow.

import { supabaseAdmin } from './supabaseAdmin'
import { EVIDENCE_BUCKET } from './evidence'
import { isMailerConfigured, sendMail, GMAIL_USER } from './mailer'
import { getNewEvidenceAlertEmail } from './emailTemplates'

// True only if the object exists. Stops a row being recorded for a path nobody uploaded to.
export async function evidenceObjectExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf('/')
  if (slash < 0) return false
  const { data, error } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 5 })
  return !error && (data ?? []).some((o) => o.name === path.slice(slash + 1))
}

const ALERT_QUIET_MS = 10 * 60 * 1000

// E-mails the firm inbox that a client sent files. A client sending several files in a row
// gets one alert: if this case already had evidence arrive in the last ten minutes (before
// these files), that earlier alert covers it. Never throws; a failed alert never loses a file.
export async function alertNewEvidence(opts: { caseId: string; files: { filename: string; facts?: string | null }[]; via: 'chat' | 'upload link' }): Promise<void> {
  try {
    if (!isMailerConfigured() || !opts.files.length) return
    const since = new Date(Date.now() - ALERT_QUIET_MS).toISOString()
    const { count } = await supabaseAdmin.from('case_evidence').select('id', { count: 'exact', head: true }).eq('case_id', opts.caseId).gte('created_at', since)
    if ((count ?? 0) > opts.files.length) return
    const { data: c } = await supabaseAdmin.from('cases').select('case_number, client_email, document_title').eq('id', opts.caseId).maybeSingle()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com'
    const email = getNewEvidenceAlertEmail({
      caseNumber: c?.case_number ?? null,
      caseTitle: c?.document_title ?? null,
      clientEmail: c?.client_email ?? null,
      files: opts.files,
      via: opts.via,
      reviewUrl: `${siteUrl.replace(/\/$/, '')}/admin?caseId=${opts.caseId}`,
    })
    await sendMail({ to: GMAIL_USER, subject: email.subject, text: email.text, html: email.html })
  } catch (err) {
    console.error('Failed to send the new-evidence alert:', err)
  }
}
