// A lawyer's note on a piece of evidence: what the document is, what it proves, its date or
// reference, whether it was printed from a phone or computer (so the Section 84 certificate must
// cover it) and anything else worth knowing. It is kept at the top of the evidence row's
// extracted_facts, above what the AI read from the file, so no schema change is needed and an
// older row without a note still reads as before. The filing-pack drafts treat the note as the
// authoritative description of the document.

export type Electronic = 'yes' | 'no' | 'unsure'

export interface EvidenceNote {
  what: string // the essence: what this document is
  proves?: string
  dateRef?: string
  electronic?: Electronic
  other?: string
  by?: string // who added the note
}

const START = '[LAWYER NOTE]'
const END = '[/LAWYER NOTE]'
const one = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const ELECTRONIC_LABEL: Record<Electronic, string> = { yes: 'Yes', no: 'No', unsure: 'Not sure' }

export function composeEvidenceText(note: EvidenceNote | null, aiFacts: string | null | undefined): string | null {
  const facts = aiFacts?.trim() || ''
  if (!note || !one(note.what)) return facts || null
  const lines = [
    START,
    `What it is: ${one(note.what)}`,
    one(note.proves) && `What it proves: ${one(note.proves)}`,
    one(note.dateRef) && `Date / reference: ${one(note.dateRef)}`,
    note.electronic && `Printed from a phone or computer: ${ELECTRONIC_LABEL[note.electronic]}`,
    one(note.other) && `Other: ${one(note.other)}`,
    one(note.by) && `Added by: ${one(note.by)}`,
    END,
  ].filter(Boolean)
  return facts ? `${lines.join('\n')}\n\n${facts}` : lines.join('\n')
}

export function parseEvidenceText(text: string | null | undefined): { note: EvidenceNote | null; facts: string | null } {
  const t = text ?? ''
  const a = t.indexOf(START)
  const b = t.indexOf(END)
  if (a !== 0 || b < 0) return { note: null, facts: t.trim() || null }
  const field = (label: string) => t.slice(0, b).match(new RegExp(`^${label}: (.*)$`, 'm'))?.[1]?.trim() || undefined
  const e = field('Printed from a phone or computer')
  const note: EvidenceNote = {
    what: field('What it is') ?? '',
    proves: field('What it proves'),
    dateRef: field('Date / reference'),
    electronic: e === 'Yes' ? 'yes' : e === 'No' ? 'no' : e === 'Not sure' ? 'unsure' : undefined,
    other: field('Other'),
    by: field('Added by'),
  }
  return { note, facts: t.slice(b + END.length).trim() || null }
}
