// A reply to opposing counsel, as the firm actually sends it: letterhead, date, Our Ref, the
// addressee block, salutation, an underlined RE line, the body, and the signature block with
// the practising stamp beside it. The drafting agent writes only the body (see
// NEGOTIATION_REPLY_PROMPT in lib/agents.ts); everything else comes from the fields a lawyer
// fills in the negotiation panel, so a reference number, a date or a name is never invented.
//
// Shared by lib/pdfGenerator.js and lib/docxGenerator.js so the PDF and the Word copy agree on
// what is a heading and what is bold.

/**
 * @typedef {Object} ReplyLetter
 * @property {string} date          YYYY-MM-DD
 * @property {string} ourRef        e.g. PLP/2026/000036
 * @property {{ firm: string, email?: string, address?: string, attention?: string }} addressee
 * @property {string} salutation    e.g. "Dear Sir,"
 * @property {string} re            subject line, without the "RE:" prefix
 * @property {string} body          letter body; headings are their own lines, **bold** inline
 * @property {string} signatory     name printed under the signature line
 * @property {boolean} [stamp]      place the NBA practising stamp beside the signature block
 */

// "1. ACCEPTANCE OF SUM SUBJECT TO STRICT TERMS:" — a numbered, upper-case line ending in a
// colon. Rendered bold and left-aligned, with its paragraph following directly beneath.
export function isReplyHeading(line) {
  const t = line.trim()
  return /^\d{1,2}\.\s+[A-Z0-9][A-Z0-9\s,.'’&()\-\/₦]*:$/.test(t) && /[A-Z]{3,}/.test(t)
}

export function referenceFor(caseNumber, date = new Date()) {
  const year = date.getFullYear()
  return caseNumber != null ? `PLP/${year}/${String(caseNumber).padStart(6, '0')}` : `PLP/${year}/PENDING`
}

// The agent returns three labelled parts. Anything unlabelled is treated as the body, so an
// off-format reply still lands in the editor rather than being lost.
export function parseReplyDraft(text) {
  const raw = (text || '').replace(/\r\n/g, '\n').trim()
  const reMatch = raw.match(/^RE:\s*(.+)$/m)
  const bodyStart = raw.indexOf('===BODY===')
  const noteStart = raw.indexOf('===STAFF NOTE===')

  let body = raw
  if (bodyStart !== -1) {
    body = raw.slice(bodyStart + '===BODY==='.length, noteStart !== -1 && noteStart > bodyStart ? noteStart : undefined)
  } else if (noteStart !== -1) {
    body = raw.slice(0, noteStart)
  }
  const staffNote = noteStart !== -1 ? raw.slice(noteStart + '===STAFF NOTE==='.length).trim() : ''

  // Belt and braces: the system adds the salutation and sign-off itself, so strip them if the
  // model included them anyway rather than printing them twice.
  body = body
    .replace(/^RE:.*$/m, bodyStart === -1 ? '' : '$&')
    .replace(/^\s*(Dear\s[^\n]*,)\s*$/im, '')
    .replace(/\n\s*Yours (faithfully|sincerely),[\s\S]*$/i, '')
    .trim()

  return { re: reMatch ? reMatch[1].trim() : '', body, staffNote }
}
