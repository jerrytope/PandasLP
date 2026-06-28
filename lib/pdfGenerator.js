import { jsPDF } from 'jspdf'

export function buildTextDocument(title, bodyText, { watermark = false } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 56
  let y = 64

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Pandas LP', marginX, y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Professional Legal Services, Powered by AI', marginX, y + 16)

  y += 40
  doc.setDrawColor(230, 57, 70)
  doc.setLineWidth(1.2)
  doc.line(marginX, y, 540, y)

  y += 28
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, marginX, y)
  y += 26

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)

  const rawLines = bodyText.split('\n')
  for (const rawLine of rawLines) {
    const wrapped = doc.splitTextToSize(rawLine.length ? rawLine : ' ', 480)
    for (const line of wrapped) {
      if (y > 760) {
        doc.addPage()
        y = 64
      }
      doc.text(line, marginX, y)
      y += 15
    }
  }

  if (watermark) {
    const pageCount = doc.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setFontSize(44)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(245, 200, 203)
      doc.text('SAMPLE — NOT FOR FILING', 297, 420, { angle: 35, align: 'center' })
      doc.setTextColor(0, 0, 0)
    }
  }

  return doc
}

export function textDocumentBlobUrl(title, bodyText, opts) {
  return buildTextDocument(title, bodyText, opts).output('bloburl')
}

export function downloadTextDocument(title, bodyText, opts) {
  const doc = buildTextDocument(title, bodyText, opts)
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.pdf`
  doc.save(filename || 'document.pdf')
}
