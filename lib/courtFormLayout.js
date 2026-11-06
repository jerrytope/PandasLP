// How each line of a drafted court form is laid out, shared by the Word (courtFormDocx.js) and
// PDF (courtFormPdf.js) builders so both look the same. Follows the firm's own formatting of its
// first edited pack: form titles centred and bold; capitals labels ("WORK ADDRESS:") bold with
// the value plain; party lines, "AND", "SIR," and signature captions left and bold; long
// paragraphs justified.

export const PAGE_BREAK = '===PAGE BREAK==='

const isCaps = (t) => /[A-Z]/.test(t) && t === t.toUpperCase()
const isFill = (t) => /^[.…_\s]+$/.test(t) && t.replace(/\s/g, '').length >= 3
const LABEL = /^([A-Z][A-Z0-9 .,'’()&/\-]{1,70}:)(\s*)(.*)$/

// One line in context: { kind, label?, rest? } where kind is 'break' | 'blank' | 'heading' |
// 'bold' | 'label' | 'body'. `prev` is the previous non-empty line.
export function classifyLine(line, prev = '') {
  const t = line.trim()
  if (t === PAGE_BREAK) return { kind: 'break' }
  if (!t) return { kind: 'blank' }
  const p = prev.trim()
  // Delta's forms print their number ("FORM SCC 1") on the left and the plaintiff's signature
  // on the right (Delta State Practice Direction on Small Claims 2023).
  // Lagos prints its form numbers ("FORM SCA 3B") on the left in the same way.
  if (/^FORM SC[AC] \d+[A-Z]?$/.test(t)) return { kind: 'bold' }
  if (t === "PLAINTIFF'S SIGNATURE") return { kind: 'right', bold: true }
  // The party named under "FROM:" / "TO" on a letter of demand form, and its salutation, sit
  // left and bold as on the prescribed form, never centred as a heading.
  if (/^(FROM:|TO:?)$/.test(p) || /^(SIR|MADAM|SIR\/MADAM),?$/.test(t)) return { kind: 'bold' }
  // The caption under a signature line ("CLAIMANT'S SIGNATURE", "DEPONENT") stays with it.
  if (isCaps(t) && p && (isFill(p) || /[.…_]{6,}\s+[.…_]{6,}/.test(p))) return { kind: 'bold' }
  if (isCaps(t) && !t.includes(':') && !/[…]|\.{3}/.test(t) && !t.endsWith(',') && !/^([A-Z0-9]{1,3}[.)]|\([a-z0-9]+\))\s/.test(t) && t.length >= 6) {
    return { kind: 'heading' }
  }
  const m = t.match(LABEL)
  if (m && isCaps(m[1]) && !isCaps(m[3] || 'x')) return { kind: 'label', label: m[1], rest: (m[2] ? ' ' : '') + m[3] }
  if (isCaps(t)) return { kind: 'bold' }
  return { kind: 'body', justify: t.length > 90 }
}

export function layoutLines(text) {
  const out = []
  let prev = ''
  for (const line of String(text).replace(/\r/g, '').split('\n')) {
    const c = classifyLine(line, prev)
    // The dotted line a right-hand caption sits under goes right with it.
    if (c.kind === 'right') {
      const before = [...out].reverse().find((o) => o.kind !== 'blank')
      if (before && isFill(before.line.trim())) Object.assign(before, { kind: 'right', bold: false })
    }
    out.push({ line, ...c })
    if (line.trim() && c.kind !== 'break') prev = line
  }
  return out
}
