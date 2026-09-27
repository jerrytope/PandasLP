// Consent: the exact words people agree to, and how their answer is recorded.
//
// Under the NDPA 2023 consent must be specific, informed, freely given and unambiguous, and the
// firm must be able to show it was given (s.26). So:
//   - each purpose has its own wording and its own tick box; marketing is never bundled with
//     being contacted about a matter, and its box always starts unticked;
//   - the page shows the text from CONSENT_TEXT and sends only the key; the server stores the
//     canonical text for that key, so the record matches exactly what was on screen;
//   - consent_records is append-only: a withdrawal is a new row with granted = false, and the
//     current state for a person is their latest row for that purpose;
//   - never edit a wording in place: add a new key (…_v2) so old records keep their meaning.

export const CONSENT_TEXT = {
  matter_contact_v1:
    'Pandas LP may contact me by phone, WhatsApp or email about this debt. My answers are kept private and used only for this.',
  marketing_v1:
    'Also send me occasional legal tips and news from Pandas LP by email or WhatsApp. I can unsubscribe at any time.',
  newsletter_v1:
    'By subscribing, you agree to receive Pandas LP’s legal tips by email, about twice a month. Unsubscribe at any time.',
} as const

export type ConsentVersion = keyof typeof CONSENT_TEXT
export type ConsentPurpose = 'matter_contact' | 'marketing'
export type ConsentChannel = 'email' | 'whatsapp' | 'sms' | 'phone'

export const CONSENT_META: Record<ConsentVersion, { purpose: ConsentPurpose; channels: ConsentChannel[] }> = {
  matter_contact_v1: { purpose: 'matter_contact', channels: ['phone', 'whatsapp', 'email'] },
  marketing_v1: { purpose: 'marketing', channels: ['email', 'whatsapp'] },
  newsletter_v1: { purpose: 'marketing', channels: ['email'] },
}

export interface ConsentRecordRow {
  id: string
  created_at: string
  email: string | null
  phone: string | null
  purpose: ConsentPurpose
  granted: boolean
  channels: ConsentChannel[]
  wording: string
  wording_version: string
  source: string
  source_id: string | null
  recorded_by: string | null
  note: string | null
}

export function normaliseEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase()
  return e ? e : null
}

// One person may appear under an email, a phone, or both. Records sharing either identifier
// belong to the same person, so a withdrawal given by WhatsApp also stops email marketing.
function personKeys(r: Pick<ConsentRecordRow, 'email' | 'phone'>): string[] {
  return [r.email ? `e:${r.email}` : null, r.phone ? `p:${r.phone}` : null].filter((k): k is string => !!k)
}

function byTime(a: ConsentRecordRow, b: ConsentRecordRow): number {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

// Groups marketing records into people (joined by a shared email or phone), each oldest first.
function groupPeople(records: ConsentRecordRow[]): ConsentRecordRow[][] {
  const marketing = records.filter((r) => r.purpose === 'marketing')
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let root = k
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!
    parent.set(k, root)
    return root
  }
  for (const r of marketing) {
    const keys = personKeys(r)
    for (const k of keys) if (!parent.has(k)) parent.set(k, k)
    for (const k of keys.slice(1)) {
      const a = find(keys[0])
      const b = find(k)
      if (a !== b) parent.set(b, a)
    }
  }
  const groups = new Map<string, ConsentRecordRow[]>()
  for (const r of marketing) {
    const k = personKeys(r)[0]
    if (!k) continue
    const root = find(k)
    groups.set(root, [...(groups.get(root) ?? []), r])
  }
  return [...groups.values()].map((g) => g.sort(byTime))
}

export interface MarketingContact {
  email: string | null
  phone: string | null
  channels: ConsentChannel[]
  since: string
  source: string
  wording_version: string
}

// Who may receive marketing right now: people whose most recent marketing record is a grant.
export function activeMarketingContacts(records: ConsentRecordRow[]): MarketingContact[] {
  const out: MarketingContact[] = []
  for (const person of groupPeople(records)) {
    const last = person[person.length - 1]
    if (!last.granted) continue
    // "since" is the start of the current unbroken run of grants.
    let i = person.length - 1
    while (i > 0 && person[i - 1].granted) i--
    const run = person.slice(i)
    out.push({
      email: [...person].reverse().find((r) => r.email)?.email ?? null,
      phone: [...person].reverse().find((r) => r.phone)?.phone ?? null,
      channels: [...new Set(run.flatMap((r) => r.channels))],
      since: run[0].created_at,
      source: run[0].source,
      wording_version: last.wording_version,
    })
  }
  return out.sort((a, b) => b.since.localeCompare(a.since))
}

// Current marketing state for one person (by email and/or phone).
export function marketingStatus(records: ConsentRecordRow[], who: { email?: string | null; phone?: string | null }): 'granted' | 'withdrawn' | 'none' {
  const keys = personKeys({ email: normaliseEmail(who.email), phone: who.phone ?? null })
  if (keys.length === 0) return 'none'
  const person = groupPeople(records).find((g) => g.some((r) => personKeys(r).some((k) => keys.includes(k))))
  if (!person) return 'none'
  return person[person.length - 1].granted ? 'granted' : 'withdrawn'
}

export function csvCell(v: string | null | undefined): string {
  const s = v ?? ''
  // Quote everything, double inner quotes, and defuse spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}
