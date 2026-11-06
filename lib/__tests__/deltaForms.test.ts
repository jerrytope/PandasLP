import { describe, it, expect } from 'vitest'
import { DELTA_SCC1_TEMPLATE, DELTA_SCC1_FIXED_LINES } from '../deltaForms'
import { AGENTS } from '../agents'
import { draftInstruction } from '../courtFilingPrompts'
import { classifyLine } from '../courtFormLayout.js'
import { buildTextDocument, PAGE_BREAK_MARKER } from '../pdfGenerator.js'

// Delta State Practice Direction on Small Claims 2023, page 14: Form SCC 1.
describe('Delta Form SCC 1', () => {
  it('the template carries every fixed line of the prescribed form, in order', () => {
    const lines = DELTA_SCC1_TEMPLATE.split('\n').map((l) => l.trim())
    let at = -1
    for (const fixed of DELTA_SCC1_FIXED_LINES) {
      const i = lines.findIndex((l, n) => n > at && (l === fixed || l.startsWith(fixed)))
      expect(i, fixed).toBeGreaterThan(at)
      at = i
    }
    expect(DELTA_SCC1_TEMPLATE).toContain('TELEPHONE NO. (S) AND E-MAIL:')
    expect(DELTA_SCC1_TEMPLATE).toContain('TELEPHONE NO (S) AND E-MAIL:')
    expect(DELTA_SCC1_TEMPLATE).toContain('I hereby claim from you')
  })

  it('every Delta demand letter from the agent carries the form on its own page', () => {
    const p = AGENTS['small-claims'].systemPrompt
    expect(p).toContain('DELTA STATE MATTERS — FORM SCC 1 IS MANDATORY')
    expect(p).toContain('Article 2(1)(e)')
    expect(p).toContain(PAGE_BREAK_MARKER)
    expect(p).toContain(DELTA_SCC1_TEMPLATE)
  })

  it('the Court filing tab drafts the prescribed form for Delta, and keeps the Lagos layout for Lagos', () => {
    expect(draftInstruction('demand_form', 'delta')).toContain(DELTA_SCC1_TEMPLATE)
    expect(draftInstruction('demand_form', 'lagos')).not.toContain('SIR/MADAM\n')
  })

  it('lays out the party lines and salutation left and bold, not as headings', () => {
    expect(classifyLine('JOEL UKPEBOR', 'FROM:').kind).toBe('bold')
    expect(classifyLine('DANIEL AUSTINE EFETOBORE', 'TO').kind).toBe('bold')
    expect(classifyLine('SIR/MADAM', 'TELEPHONE NO (S) AND E-MAIL: …').kind).toBe('bold')
    expect(classifyLine('LETTER OF DEMAND', 'SMALL CLAIMS COURT').kind).toBe('heading')
  })

  it('prints a Delta letter with the form on a second page', () => {
    const body = `Our Ref: PLP/2026/000007\n\nDear Sir/Madam,\n\nLetter text.\n\nYours faithfully,\n\n${PAGE_BREAK_MARKER}\n${DELTA_SCC1_TEMPLATE}`
    expect(buildTextDocument('Letter', body).getNumberOfPages()).toBe(2)
  })
})

describe('Delta form layout', () => {
  it('puts the form number on the left and the plaintiff signature on the right, as printed', async () => {
    const { layoutLines } = await import('../courtFormLayout.js')
    const out = layoutLines(DELTA_SCC1_TEMPLATE)
    expect(out.find((l) => l.line === 'FORM SCC 1')?.kind).toBe('bold')
    const sig = out.findIndex((l) => l.line === "PLAINTIFF'S SIGNATURE")
    expect(out[sig].kind).toBe('right')
    expect(out[sig - 1].kind).toBe('right')
  })
})
