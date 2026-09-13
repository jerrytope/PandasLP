import { describe, it, expect } from 'vitest'
import { isTitleLine, normalizeForPdf, buildTextDocument, buildStampedDocument } from '../pdfGenerator.js'

describe('normalizeForPdf', () => {
  it('substitutes the Naira glyph, which the PDF font cannot render', () => {
    expect(normalizeForPdf('₦600,000')).toBe('N600,000')
  })

  it('leaves text without the glyph untouched', () => {
    expect(normalizeForPdf('No currency symbols here.')).toBe('No currency symbols here.')
  })

  it('substitutes every occurrence, not just the first', () => {
    expect(normalizeForPdf('₦150,000 of ₦600,000')).toBe('N150,000 of N600,000')
  })
})

describe('isTitleLine', () => {
  it('recognises an all-caps heading', () => {
    expect(isTitleLine('LETTER OF DEMAND FOR THE PAYMENT OF OUTSTANDING DEBT')).toBe(true)
  })

  it('rejects ordinary sentence-case body text', () => {
    expect(isTitleLine('I, Tunde Bello, write to demand payment of a debt owed to me.')).toBe(false)
  })

  it('rejects lines that are too short to be a heading', () => {
    expect(isTitleLine('RE')).toBe(false)
  })

  it('rejects a lowercase line even if short and punctuation-free', () => {
    expect(isTitleLine('yours faithfully')).toBe(false)
  })
})

// buildStampedDocument is the "Attach Stamp" one-click flow's own builder (see
// app/admin/page.tsx) — it must place Pandas LP's real NBA practicing stamp only where a
// signature actually belongs, and never watermark what is, by definition, the reviewed final.
describe('buildStampedDocument', () => {
  const WITH_SIGNATURE = `RE: LETTER OF DEMAND

Body text here.

Yours faithfully,

For: PANDAS LP


________________________
Adedeji Adeyemo Esq
Legal Representative, Pandas LP`

  it('produces a real PDF', async () => {
    const buffer = Buffer.from(buildStampedDocument('Letter of Demand', WITH_SIGNATURE).output('arraybuffer'))
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('embeds the stamp image when a signature line is present', async () => {
    const stamped = Buffer.from(buildStampedDocument('Letter of Demand', WITH_SIGNATURE).output('arraybuffer'))
    const plain = Buffer.from(buildTextDocument('Letter of Demand', WITH_SIGNATURE, { watermark: false }).output('arraybuffer'))
    // An embedded PNG is tens of KB — this is not a rounding difference between two otherwise
    // identical renders, it's the presence or absence of a whole extra image object.
    expect(stamped.length).toBeGreaterThan(plain.length + 5000)
  })

  it('never draws the stamp when no signature line exists to anchor it to', async () => {
    const noSignature = 'RE: LETTER OF DEMAND\n\nBody text with no sign-off block at all.'
    const stamped = Buffer.from(buildStampedDocument('Letter of Demand', noSignature).output('arraybuffer'))
    const plain = Buffer.from(buildTextDocument('Letter of Demand', noSignature, { watermark: false }).output('arraybuffer'))
    // Same content, same watermark setting (none) — the only variable is stampDataUri, so
    // with no anchor found, the two outputs should be identical in size.
    expect(stamped.length).toBe(plain.length)
  })
})
