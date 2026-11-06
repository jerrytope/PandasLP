// Court forms as plain Word documents for the practitioner to complete and sign. No firm
// letterhead: these are court processes, not letters. Line layout (centred titles, bold
// labels, justified paragraphs) comes from courtFormLayout.js, shared with the PDF.

import { Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak } from 'docx'
import { PAGE_BREAK, layoutLines } from './courtFormLayout.js'

const run = (text, bold = false) => new TextRun({ text, bold, font: 'Times New Roman', size: 24 })

export function buildCourtForm(text) {
  const paragraphs = layoutLines(text).map((l) => {
    if (l.kind === 'break') return new Paragraph({ children: [new PageBreak()] })
    const spacing = { after: l.kind === 'blank' ? 60 : 120, line: 300 }
    if (l.kind === 'heading') return new Paragraph({ alignment: AlignmentType.CENTER, spacing, children: [run(l.line.trim(), true)] })
    if (l.kind === 'label') return new Paragraph({ alignment: l.rest.length > 80 ? AlignmentType.JUSTIFIED : AlignmentType.LEFT, spacing, children: [run(l.label, true), run(l.rest)] })
    if (l.kind === 'bold') return new Paragraph({ spacing, children: [run(l.line, true)] })
    if (l.kind === 'right') return new Paragraph({ alignment: AlignmentType.RIGHT, spacing, children: [run(l.line.trim(), Boolean(l.bold))] })
    return new Paragraph({ alignment: l.justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT, spacing, children: [run(l.line)] })
  })
  return new Document({
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } }, children: paragraphs }],
  })
}

export async function downloadCourtFormDocx(title, text) {
  await save(title, buildCourtForm(text))
}

// Several forms in one Word file, each on a new page, in the order given.
export async function downloadCourtPackDocx(title, texts) {
  await save(title, buildCourtForm(texts.join(`\n${PAGE_BREAK}\n`)))
}

async function save(title, doc) {
  const blob = await Packer.toBlob(doc)
  const name = `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.docx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name || 'court-form.docx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
