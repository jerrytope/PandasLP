// Tells staff a property matter needs a lawyer (escalated, or a document nothing is paid for
// online). Goes to the firm's inbox (GMAIL_USER), like the new-order alert, with a link that
// opens the matter in the admin (?caseId= opens All Matters). Best effort: a failed email is
// logged, and the matter is in Admin → Action Queue either way.

import { GMAIL_USER, isMailerConfigured, sendMail } from '../mailer'
import { baseWrapper } from '../emailTemplates'
import { supabaseAdmin } from '../supabaseAdmin'
import { AREAS } from './areas'
import type { LawyerAlert } from './orchestrator'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The email. Pure, so it is unit-tested. The reason can contain the client's words: escaped. */
export function getLawyerAlertEmail(data: LawyerAlert & { clientEmail: string | null; siteUrl: string }): { subject: string; html: string; text: string } {
  const area = data.area ? AREAS[data.area].title : 'not yet routed'
  const reviewUrl = `${data.siteUrl}/admin?caseId=${encodeURIComponent(data.caseId)}`
  const escalated = data.reason.startsWith('Escalated')
  const headline = escalated ? 'A property matter needs a lawyer' : 'A property document needs the firm'
  const rows: [string, string][] = [
    ['Client', data.clientEmail ?? 'unknown'],
    ['Area', area],
    ['State', data.state ?? 'not given yet'],
    ['Why', data.reason],
  ]
  return {
    subject: `${headline} | ${area}${data.state ? `, ${data.state}` : ''}`,
    text: `${headline}.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nOpen the matter: ${reviewUrl}\n\nIt is also in Admin → Action Queue until someone takes it.\n\nPandas LP`,
    html: baseWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#F3EFE3;letter-spacing:-0.01em;">${headline}</h2>
      <table style="width:100%;margin:0 0 20px;font-size:14px;color:#ABB1A2;">
        ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;">${k}</td><td style="padding:4px 0;color:#F3EFE3;">${escapeHtml(v)}</td></tr>`).join('')}
      </table>
      <p style="margin:0 0 20px;font-size:14px;color:#ABB1A2;line-height:1.6;">It stays in Admin → Action Queue until someone takes it.</p>
      <a href="${reviewUrl}" style="display:inline-block;background:#D6BB80;color:#182A3A;font-size:14px;font-weight:700;text-decoration:none;padding:13px 24px;border-radius:12px;">Open the matter →</a>
    `),
  }
}

async function clientEmailFor(caseId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('cases').select('user_id, client_email').eq('id', caseId).maybeSingle()
  if (!data) return null
  if (data.client_email) return data.client_email as string
  if (!data.user_id) return null
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(data.user_id as string)
  return user?.user?.email ?? null
}

/** The notifier /api/chat gives the orchestrator: emails the firm's inbox, if mail is set up. */
export async function emailLawyerAlert(alert: LawyerAlert): Promise<void> {
  if (!isMailerConfigured()) return
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const email = getLawyerAlertEmail({ ...alert, clientEmail: await clientEmailFor(alert.caseId), siteUrl })
    await sendMail({ to: GMAIL_USER, ...email })
  } catch (err) {
    console.error(`Lawyer alert for case ${alert.caseId} not sent:`, err)
  }
}
