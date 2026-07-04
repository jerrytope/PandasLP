import { describe, it, expect } from 'vitest'
import { isTitleLine, normalizeForPdf } from '../pdfGenerator.js'

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
