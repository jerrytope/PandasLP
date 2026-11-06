// Court forms as a plain A4 PDF: the filing pack the client prints, signs and sends back. No firm
// letterhead (these are court processes, not letters). Same line layout as the Word file
// (courtFormLayout.js): centred bold titles, bold labels, justified paragraphs, each form on a
// new page.

import { jsPDF } from 'jspdf'
import { layoutLines } from './courtFormLayout.js'

const MARGIN = 64
const LINE = 15.5
const SIZE = 11.5

// The standard PDF fonts cannot draw the Naira sign or the one-character ellipsis.
function clean(text) {
  return String(text).replace(/\r/g, '').replace(/₦/g, 'N').replace(/…/g, '...')
}

export function buildCourtPackPdf(texts) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const width = pageW - MARGIN * 2
  doc.setFontSize(SIZE)
  doc.setLineHeightFactor(LINE / SIZE)
  let y = MARGIN
  const room = () => { if (y > pageH - MARGIN) { doc.addPage(); y = MARGIN } }

  // A paragraph: lines laid out to the width, justified (except each page's last line) if asked.
  const paragraph = (text, { bold = false, justify = false, center = false, right = false } = {}) => {
    doc.setFont('times', bold ? 'bold' : 'normal')
    const lines = doc.splitTextToSize(text, width)
    lines.forEach((ln, i) => {
      room()
      const last = i === lines.length - 1 || y + LINE > pageH - MARGIN
      if (center) doc.text(ln, pageW / 2, y, { align: 'center' })
      else if (right) doc.text(ln, pageW - MARGIN, y, { align: 'right' })
      else if (justify && !last) doc.text(ln, MARGIN, y, { align: 'justify', maxWidth: width })
      else doc.text(ln, MARGIN, y)
      y += LINE
    })
  }

  // A bold capitals label followed by its value on the same line, wrapping under it.
  const labelled = (label, rest) => {
    room()
    doc.setFont('times', 'bold')
    const lw = doc.getTextWidth(label)
    doc.text(label, MARGIN, y)
    doc.setFont('times', 'normal')
    const firstWidth = width - lw
    const words = rest.split(/(\s+)/)
    let first = ''
    let i = 0
    for (; i < words.length; i++) {
      if (doc.getTextWidth(first + words[i]) > firstWidth) break
      first += words[i]
    }
    if (first) doc.text(first, MARGIN + lw, y)
    y += LINE
    const remainder = words.slice(i).join('').trim()
    if (remainder) paragraph(remainder, { justify: remainder.length > 80 })
  }

  texts.forEach((text, n) => {
    if (n > 0) { doc.addPage(); y = MARGIN }
    for (const l of layoutLines(clean(text))) {
      if (l.kind === 'break') { doc.addPage(); y = MARGIN; continue }
      if (l.kind === 'blank') { y += LINE / 2; continue }
      if (l.kind === 'heading') paragraph(l.line.trim(), { bold: true, center: true })
      else if (l.kind === 'label') labelled(l.label, l.rest)
      else if (l.kind === 'bold') paragraph(l.line, { bold: true })
      else if (l.kind === 'right') paragraph(l.line.trim(), { bold: Boolean(l.bold), right: true })
      else paragraph(l.line, { justify: l.justify })
    }
  })

  const pages = doc.getNumberOfPages()
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.text(`Page ${p} of ${pages}`, pageW / 2, pageH - 30, { align: 'center' })
  }
  return doc
}

export function buildCourtPackPdfBuffer(texts) {
  return Buffer.from(buildCourtPackPdf(texts).output('arraybuffer'))
}
