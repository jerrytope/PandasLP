// The covering e-mail that sends the reviewed filing pack to the client: what to print, where to
// put the passport photograph, what to sign and what NOT to sign yet, how to send the scans
// back, and when they must come to the registry. Staff see it, can edit it, and then send it
// from the Court filing tab (app/api/admin/court-filing/send-pack).

import { docTitle, formLabel, naira, rulesFor, type ClaimFigures, type DocKind } from './courtFiling'

export const FIRM_WHATSAPP = '+234 811 808 0189'
export const FIRM_WHATSAPP_URL = 'https://wa.me/2348118080189'
// Replaced with the case's private upload link (lib/uploadLink.ts) when the e-mail is sent.
export const UPLOAD_LINK_PLACEHOLDER = '{{UPLOAD_LINK}}'

// A bracketed capitals placeholder the AI left for a practitioner, e.g. [DEFENDANT'S ADDRESS],
// or «…» instruction text it should have replaced. A passport photograph box may stay.
export function unfilledPlaceholders(texts: string[]): string[] {
  const found = new Set<string>()
  for (const t of texts) {
    for (const m of t.matchAll(/«[^»\n]{1,200}»/g)) found.add(m[0].length > 60 ? `${m[0].slice(0, 57)}…»` : m[0])
    for (const m of t.matchAll(/\[[A-Z][^\]\n]{2,80}\]/g)) {
      if (/PASSPORT PHOTOGRAPH/.test(m[0]) || m[0] !== m[0].toUpperCase()) continue
      found.add(m[0])
    }
  }
  return [...found]
}

export interface ClientPackEmailInput {
  clientName?: string
  defendantName?: string
  state: string
  registry?: string | null
  kinds: DocKind[] // the forms attached, in bundle order
  caseNumber?: number
  figures?: ClaimFigures // what the forms claim; shown so the client knows the figures they are signing
}

export function clientPackMessage(d: ClientPackEmailInput): { subject: string; text: string } {
  const F = (n: number | string) => formLabel(d.state, n)
  const has = (k: DocKind) => d.kinds.includes(k)
  const name = d.clientName?.trim().split(/\s+/)[0] || 'there'
  const lagosSj = rulesFor(d.state).summaryJudgment && has('sj_affidavit')
  const signHere = [has('demand_form') && F(1), has('complaint') && F(2), has('summary_judgment') && F('3A')].filter(Boolean) as string[]
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '')

  const steps: string[] = [
    'Print every page on A4 paper, one side only.',
    'Read each form carefully. If any detail is wrong or missing, tell us before you sign.',
  ]
  if (has('complaint')) steps.push(`Paste a recent passport photograph at the top right of the first page of ${F(2)} (the complaint form).`)
  if (signHere.length) steps.push(`Sign, or put your thumbprint, where it says "Claimant's signature" on ${list(signHere)}.${has('complaint') ? ` Write the date beside your signature on ${F(2)}.` : ''}`)
  if (lagosSj) steps.push(`Do NOT sign ${F('3B')} (the affidavit) yet. It must be signed in front of the Commissioner for Oaths at the court registry.`)
  if (has('s84_certificate')) steps.push('If you printed the e-mails, receipts or messages we are relying on yourself, sign the Section 84 certificate and fill in the computer and printer you used. If we printed them, leave it for us.')
  steps.push(`Scan every signed page, or take clear photos in good light with nothing cut off, and upload them here: ${UPLOAD_LINK_PLACEHOLDER} (the link works for 30 days). You can also send them back by replying to this e-mail or on WhatsApp.`)
  steps.push('Keep the signed originals safe. They are needed for filing.')

  const where = d.registry?.trim() ? `the Small Claims registry at ${d.registry.trim()}` : 'the Small Claims registry where we file (we will send you the address)'
  const court = lagosSj
    ? `COMING TO COURT\nYou will need to come to ${where} with a valid ID and the signed originals, to swear the affidavit (${F('3B')}) before the Commissioner for Oaths. We will agree the day and time with you.`
    : 'COMING TO COURT\nWe will tell you if you need to come to the registry, and agree the day and time with you.'

  const fig = d.figures
  const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const claim = fig && fig.sum > 0
    ? `WHAT WE ARE CLAIMING
- The debt: ${naira(fig.sum)}
- Interest: ${fig.interestFixed ? naira(fig.interest) : fig.interestFrom ? `${naira(fig.interest)} (${fig.rate}% a year from ${longDate(fig.interestFrom)} to ${longDate(fig.interestTo)}), and further interest at ${fig.rate}% a year until judgment` : `${fig.rate}% a year from the date the money fell due until judgment`}
- Costs: ${naira(fig.costs)} (${fig.costsNote})
- Total: ${naira(fig.total)}, plus the court fees the registry sets

`
    : ''

  const text = `Dear ${name},

Your Small Claims Court papers${d.defendantName ? ` against ${d.defendantName}` : ''} are ready. We have checked them, and they are attached to this e-mail as one PDF:
${d.kinds.map((k) => `- ${docTitle(k, d.state)}`).join('\n')}

${claim}WHAT WE NEED YOU TO DO
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

${court}

QUESTIONS
Chat with us or call us on WhatsApp on ${FIRM_WHATSAPP} (${FIRM_WHATSAPP_URL}), or reply to this e-mail.

Pandas LP`

  return { subject: `Your court papers to sign${d.caseNumber ? ` (case #${d.caseNumber})` : ''} | Pandas LP`, text }
}
