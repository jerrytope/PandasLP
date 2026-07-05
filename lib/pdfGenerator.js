import { jsPDF } from 'jspdf'
import { PANDAS_LOGO_DATA_URI, PANDAS_LOGO_WIDTH, PANDAS_LOGO_HEIGHT } from './logoData.js'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN_X = 56
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const FOOTER_HEIGHT = 46
const LINE_HEIGHT = 14.5

const BRAND_RED = [230, 57, 70]
const BRAND_BLACK = [10, 10, 10]
const BRAND_GRAY = [110, 110, 110]

function drawPandaLogo(doc, x, y, height) {
  const width = height * (PANDAS_LOGO_WIDTH / PANDAS_LOGO_HEIGHT)
  doc.addImage(PANDAS_LOGO_DATA_URI, 'PNG', x, y, width, height)
  return width
}

function drawLetterhead(doc) {
  const logoHeight = 40
  const logoX = MARGIN_X
  const logoY = 40
  const logoWidth = drawPandaLogo(doc, logoX, logoY, logoHeight)

  const textX = logoX + logoWidth + 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BRAND_BLACK)
  doc.text('Pandas', textX, logoY + 18)
  const pandasWidth = doc.getTextWidth('Pandas ')
  doc.setTextColor(...BRAND_RED)
  doc.text('LP', textX + pandasWidth, logoY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...BRAND_GRAY)
  doc.text('Professional Legal Services, Powered by AI', textX, logoY + 33)

  let y = logoY + logoHeight + 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND_RED)
  doc.text(
    'DEBT RECOVERY   |   TENANCY & PROPERTY   |   CONTRACTS & AGREEMENTS   |   BUSINESS REGISTRATION',
    PAGE_WIDTH / 2,
    y,
    { align: 'center' },
  )

  y += 12
  doc.setDrawColor(...BRAND_RED)
  doc.setLineWidth(1.4)
  doc.line(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y)

  y += 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...BRAND_BLACK)
  doc.text('Date: _______________________', PAGE_WIDTH - MARGIN_X, y, { align: 'right' })

  return y + 26
}

function drawFooter(doc) {
  const y0 = PAGE_HEIGHT - FOOTER_HEIGHT
  doc.setFillColor(...BRAND_BLACK)
  doc.rect(0, y0, PAGE_WIDTH, FOOTER_HEIGHT, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text('Pandas LP', MARGIN_X, y0 + FOOTER_HEIGHT / 2 - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(215, 215, 215)
  doc.text(
    'pandaslegalpractitioners@gmail.com   ·   +234 811 808 0189   ·   pandaslp.ng',
    MARGIN_X,
    y0 + FOOTER_HEIGHT / 2 + 9,
  )

  doc.setTextColor(0, 0, 0)
}

export function isTitleLine(line) {
  const trimmed = line.trim()
  if (trimmed.length < 3 || trimmed.length > 90) return false
  return /^[A-Z0-9][A-Z0-9\s,.'’\-—:()&/]*$/.test(trimmed) && /[A-Z]{2,}/.test(trimmed)
}

function splitBoldSegments(line) {
  const segments = []
  const re = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match
  while ((match = re.exec(line))) {
    if (match.index > lastIndex) segments.push({ text: line.slice(lastIndex, match.index), bold: false })
    segments.push({ text: match[1], bold: true })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < line.length) segments.push({ text: line.slice(lastIndex), bold: false })
  return segments
}

function segmentsToWords(segments) {
  const words = []
  for (const seg of segments) {
    const tokens = seg.text.split(/(\s+)/).filter((t) => t.length > 0)
    for (const token of tokens) words.push({ text: token, bold: seg.bold })
  }
  return words
}

function renderRichLine(doc, line, x, y, maxWidth, lineHeight) {
  const words = segmentsToWords(splitBoldSegments(line))
  let cursorY = y
  let lineWords = []
  let lineWidth = 0

  function flush() {
    let cx = x
    for (const w of lineWords) {
      doc.setFont('helvetica', w.bold ? 'bold' : 'normal')
      doc.text(w.text, cx, cursorY)
      cx += doc.getTextWidth(w.text)
    }
    lineWords = []
    lineWidth = 0
    cursorY += lineHeight
  }

  for (const word of words) {
    doc.setFont('helvetica', word.bold ? 'bold' : 'normal')
    const w = doc.getTextWidth(word.text)
    if (word.text.trim() === '') {
      if (lineWidth + w > maxWidth) continue
      lineWords.push(word)
      lineWidth += w
      continue
    }
    if (lineWidth + w > maxWidth && lineWords.length > 0) flush()
    lineWords.push(word)
    lineWidth += w
  }
  if (lineWords.length > 0) flush()

  doc.setFont('helvetica', 'normal')
  return cursorY
}

// jsPDF's standard Helvetica font does not include the Naira glyph (₦) and silently
// mis-measures it, corrupting the layout of any text on the same line. Substitute a
// supported character before doing any width measurement or rendering.
export function normalizeForPdf(text) {
  return text.replace(/₦/g, 'N')
}

export function buildTextDocument(title, bodyText, { watermark = false } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = drawLetterhead(doc)
  const bottomLimit = PAGE_HEIGHT - FOOTER_HEIGHT - 24

  doc.setFontSize(10.5)
  doc.setTextColor(...BRAND_BLACK)

  const rawLines = normalizeForPdf(bodyText).split('\n')
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim()

    // Strip meta-instructions that belong in the chat, not the printed letter
    if (trimmed.startsWith('NOTE TO SENDER') || trimmed.startsWith('[Date to be inserted')) continue

    if (y > bottomLimit) {
      doc.addPage()
      y = 64
      doc.setFontSize(10.5)
      doc.setTextColor(...BRAND_BLACK)
    }

    if (trimmed === '') {
      y += LINE_HEIGHT * 0.6
      continue
    }

    if (isTitleLine(trimmed)) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12.5)
      doc.text(trimmed, PAGE_WIDTH / 2, y, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.5)
      y += LINE_HEIGHT + 6
      continue
    }

    y = renderRichLine(doc, rawLine, MARGIN_X, y, CONTENT_WIDTH, LINE_HEIGHT)
  }

  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    drawFooter(doc)

    if (watermark) {
      doc.setFontSize(44)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(245, 200, 203)
      doc.text('SAMPLE — NOT FOR FILING', PAGE_WIDTH / 2, 420, { angle: 35, align: 'center' })
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
