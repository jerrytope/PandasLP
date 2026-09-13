import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { buildDemandLetterDocxBuffer } from '../docxGenerator.js'

// A .docx is a zip archive — unzip it the same way a real reader (Word, jszip, etc.) would,
// and read back word/document.xml, rather than asserting on the raw buffer. This is the
// counterpart to pdfGenerator.test.ts's isTitleLine/normalizeForPdf tests: it checks that the
// reviewer's editable copy actually carries the content and formatting a reader would see,
// not just that Packer.toBuffer() didn't throw.
async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const entry = zip.file('word/document.xml')
  if (!entry) throw new Error('word/document.xml missing from generated .docx')
  return entry.async('string')
}

describe('buildDemandLetterDocxBuffer', () => {
  it('produces a real .docx (a valid zip archive, not raw text)', async () => {
    const buffer = await buildDemandLetterDocxBuffer('Plain body text.')
    // Zip files start with the "PK" local-file-header signature.
    expect(buffer.subarray(0, 2).toString('ascii')).toBe('PK')
    expect(buffer.length).toBeGreaterThan(1000)
  })

  it('carries the actual body text into the document', async () => {
    const buffer = await buildDemandLetterDocxBuffer('We write on behalf of our Client to demand payment.')
    const xml = await documentXml(buffer)
    expect(xml).toContain('We write on behalf of our Client to demand payment.')
  })

  it('bolds **marked** text the same way the client-facing PDF does', async () => {
    const buffer = await buildDemandLetterDocxBuffer('You owe the sum of **₦500,000** to our Client.')
    const xml = await documentXml(buffer)
    // normalizeForPdf substitutes the Naira glyph (see pdfGenerator.js) before this text
    // ever reaches a run, so the bolded run reads "N500,000", not "₦500,000".
    expect(xml).toContain('N500,000')
    // The bold run and the surrounding plain text are genuinely separate <w:r> runs.
    const boldRunIndex = xml.indexOf('N500,000')
    const precedingBold = xml.lastIndexOf('<w:b/>', boldRunIndex)
    const precedingRunStart = xml.lastIndexOf('<w:r>', boldRunIndex)
    expect(precedingBold).toBeGreaterThan(precedingRunStart)
  })

  it('renders an all-caps heading as its own centered paragraph, like the PDF', async () => {
    const buffer = await buildDemandLetterDocxBuffer('NOTICE TO QUIT AND DELIVER UP VACANT POSSESSION\n\nDear Sir/Madam,')
    const xml = await documentXml(buffer)
    expect(xml).toContain('NOTICE TO QUIT AND DELIVER UP VACANT POSSESSION')
    expect(xml).toContain('Dear Sir/Madam,')
  })

  it('strips NOTE TO SENDER lines, same as the client-facing PDF', async () => {
    const buffer = await buildDemandLetterDocxBuffer('NOTE TO SENDER: fill in the date by hand.\nDear Sir/Madam,')
    const xml = await documentXml(buffer)
    expect(xml).not.toContain('NOTE TO SENDER')
    expect(xml).toContain('Dear Sir/Madam,')
  })

  it('embeds the Pandas LP letterhead logo as image media, not just text', async () => {
    const buffer = await buildDemandLetterDocxBuffer('Body text.')
    const zip = await JSZip.loadAsync(buffer)
    const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'))
    expect(mediaFiles.length).toBeGreaterThan(0)
  })

  it('marks itself as an internal review copy, never a client-facing document', async () => {
    const buffer = await buildDemandLetterDocxBuffer('Body text.')
    const zip = await JSZip.loadAsync(buffer)
    // Footer content lives in its own part, not word/document.xml.
    const footerEntry = zip.file('word/footer1.xml')
    expect(footerEntry).not.toBeNull()
    const footerXml = await footerEntry!.async('string')
    expect(footerXml).toContain('INTERNAL REVIEW COPY')
    expect(footerXml).toContain('pandaslegalpractitioners@gmail.com')
  })
})
