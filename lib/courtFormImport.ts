// Brings forms edited outside the dashboard (Google Docs → File → Download → Microsoft Word)
// back into the Court filing tab. The .docx text becomes the new saved version of each form, so
// the PDF the client receives is built from the edited wording. A whole pack is split into its
// forms by their headings ("FORM SCA 2", "CERTIFICATE OF IDENTIFICATION", ...).

import JSZip from 'jszip'
import type { DocKind } from './courtFiling'

export const PAGE_BREAK = '===PAGE BREAK==='

function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

// The text of word/document.xml, one line per paragraph, with explicit page breaks kept as
// PAGE_BREAK lines. Formatting is dropped: the PDF and Word builders restyle headings themselves.
export function documentXmlToText(xml: string): string {
  const body = xml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/)?.[1] ?? xml
  const lines: string[] = []
  for (const p of body.match(/<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []) {
    if (/<w:pageBreakBefore(?:\s+w:val="(?:true|1|on)")?\s*\/>/.test(p)) lines.push(PAGE_BREAK)
    let line = ''
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br(\s[^>]*)?\/>|<w:cr\/>/g)) {
      if (m[1] !== undefined) line += decode(m[1])
      else if (m[0] === '<w:tab/>') line += '    '
      else if (m[0].startsWith('<w:br') && /w:type="page"/.test(m[2] ?? '')) { lines.push(line); lines.push(PAGE_BREAK); line = '' }
      else { lines.push(line); line = '' }
    }
    lines.push(line)
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export async function docxToText(data: ArrayBuffer): Promise<string> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    throw new Error('That file is not a Word document. In Google Docs choose File → Download → Microsoft Word (.docx), then upload that file.')
  }
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('That file is not a Word document. In Google Docs choose File → Download → Microsoft Word (.docx), then upload that file.')
  return documentXmlToText(xml)
}

const BY_NUMBER: Record<string, DocKind> = { '1': 'demand_form', '2': 'complaint', '3': 'summons', '3A': 'summary_judgment', '3B': 'sj_affidavit' }

// Which form a piece of text is, from its opening lines.
export function identifyForm(text: string): DocKind | null {
  const head = text.split('\n').map((l) => l.trim()).filter((l) => l && l !== PAGE_BREAK).slice(0, 8)
  for (const l of head) {
    const m = l.toUpperCase().match(/^FORM\s+(?:SCA|SCC)?\s*(\d+[AB]?)\b/)
    if (m && BY_NUMBER[m[1]]) return BY_NUMBER[m[1]]
  }
  const top = head.join(' ').toUpperCase()
  if (top.includes('CERTIFICATE OF IDENTIFICATION')) return 's84_certificate'
  if (top.includes('EXHIBIT LIST')) return 'exhibits'
  if (top.includes('AFFIDAVIT IN SUPPORT OF APPLICATION FOR SUMMARY JUDGMENT')) return 'sj_affidavit'
  if (top.includes('APPLICATION FOR SUMMARY JUDGMENT')) return 'summary_judgment'
  if (top.includes('COMPLAINT FORM')) return 'complaint'
  if (top.includes('LETTER OF DEMAND')) return 'demand_form'
  if (/\bSUMMONS\b/.test(top)) return 'summons'
  return null
}

export interface SplitResult {
  forms: { kind: DocKind; body: string }[]
  unrecognised: string[] // the opening line of any part that could not be matched to a form
}

// Splits a whole pack at its page breaks. A page that does not start a new form (a manual page
// break inside a long form) stays with the form before it. A later copy of the same form wins.
export function splitIntoForms(text: string): SplitResult {
  const parts = text.split(new RegExp(`\\n?${PAGE_BREAK}\\n?`)).map((p) => p.trim()).filter(Boolean)
  const forms: { kind: DocKind; body: string }[] = []
  const unrecognised: string[] = []
  for (const part of parts) {
    const kind = identifyForm(part)
    if (kind) forms.push({ kind, body: part })
    else if (forms.length) forms[forms.length - 1].body += `\n\n${part}`
    else unrecognised.push(part.split('\n')[0].slice(0, 80))
  }
  const latest = new Map<DocKind, string>()
  for (const f of forms) latest.set(f.kind, f.body)
  return { forms: [...latest].map(([kind, body]) => ({ kind, body })), unrecognised }
}
