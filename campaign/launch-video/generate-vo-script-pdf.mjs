// Renders 15-voiceover-script-for-recording.md as a clean PDF for a VO artist to record
// against. Plain jsPDF (already a project dependency, same library the app uses for case
// documents) — no letterhead/watermark, since this is an internal production script, not a
// client-facing legal document.
import { jsPDF } from 'jspdf'
import { readFileSync, writeFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../lib/logoData.js', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

// jsPDF's standard Helvetica font has no Naira glyph — substitute before rendering, same
// fix used throughout the app (see lib/pdfGenerator.js's normalizeForPdf).
const naira = (s) => s.replace(/₦/g, 'N')

const scenes = [
  { n: 1, tc: '0:00–0:03', dur: '3.00s', onscreen: 'WhatsApp thread: "I\'ll pay you next week"', vo: '(no VO — silent, text carries it)' },
  { n: 2, tc: '0:03–0:09', dur: '5.71s', onscreen: 'Deposit receipt card — ₦450,000, no delivery', vo: "Whether it's a deposit, a loan, or an invoice — someone stringing you along feels the same." },
  { n: 3, tc: '0:09–0:13', dur: '4.25s', onscreen: 'Logo reveal: "PANDAS LP — YOUR AI LEGAL TEAM"', vo: "This is Pandas LP — Nigeria's AI-native legal team." },
  { n: 4, tc: '0:13–0:19', dur: '6.23s', onscreen: 'Chat demo — "He took my ₦450,000 deposit and never delivered."', vo: 'Tell it what happened, in your own words. Upload your proof, and it tells you on the spot what holds up.' },
  { n: 5, tc: '0:19–0:27', dur: '8.21s', onscreen: 'Pricing cards — ₦10,000 self-serve / ₦25,000 we serve it', vo: 'Choose how it goes out. Ten thousand naira to serve it yourself — twenty-five thousand, and our team delivers it. You see the price before you pay anything.' },
  { n: 6, tc: '0:27–0:32', dur: '4.87s', onscreen: 'Case tracker — Paid -> Served -> Filed -> Judgment', vo: "Track every stage from your dashboard. If they still won't pay, we escalate to court for you." },
  { n: 7, tc: '0:32–0:39', dur: '6.32s', onscreen: 'Notice of Demand letter, "REVIEWED" stamp', vo: "Every letter is reviewed and signed by a licensed lawyer before it's ever sent." },
  { n: 8, tc: '0:39–0:45', dur: '6.48s', onscreen: 'End card — "THEY OWE YOU. WE GO AFTER IT." / pandaslp.com.ng', vo: 'Pandas LP. They owe you — go after it, at pandaslp dot com dot ng.' },
]

const doc = new jsPDF({ unit: 'pt', format: 'a4' })
const PAGE_W = 595.28
const MARGIN = 56
const CONTENT_W = PAGE_W - MARGIN * 2
const GOLD = [184, 134, 11]
const INK = [26, 26, 26]
const MUTED = [107, 107, 107]
const BORDER = [216, 210, 200]

let y = MARGIN

function header() {
  doc.addImage(LOGO_DATA_URI, 'PNG', MARGIN, y, 26, 17)
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INK)
  doc.text('Pandas LP', MARGIN + 34, y + 12)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED)
  doc.text('Creative & Content Strategy', PAGE_W - MARGIN, y + 12, { align: 'right' })
  y += 34
  doc.setDrawColor(...BORDER).setLineWidth(0.75)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 26
}

header()

doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...INK)
doc.text('Voiceover Script — Explainer Video', MARGIN, y)
y += 22
doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED)
doc.text(
  'For pandas-lp-explainer-FIXED-NO-VO.mp4 — 45.1s, video and captions final, audio track silent.',
  MARGIN, y,
)
y += 14
doc.text('Read straight through, this script fills the full runtime.', MARGIN, y)
y += 26

// Delivery note box
doc.setFillColor(250, 248, 243).setDrawColor(...BORDER).roundedRect(MARGIN, y, CONTENT_W, 54, 4, 4, 'FD')
doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...GOLD)
doc.text('DELIVERY', MARGIN + 14, y + 16)
doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...INK)
doc.text(
  doc.splitTextToSize(
    'Nigerian-accented, warm, confident, unhurried — a senior lawyer talking to someone they’re on the side of, not a hype-reel narrator. About 150 words per minute.',
    CONTENT_W - 28,
  ),
  MARGIN + 14, y + 30,
)
y += 70

// Scene table
for (const s of scenes) {
  const bodyLines = doc.splitTextToSize(naira(s.vo), CONTENT_W - 90)
  const onscreenLines = doc.splitTextToSize(naira(s.onscreen), CONTENT_W - 90)
  const blockH = 22 + Math.max(bodyLines.length, 1) * 12 + onscreenLines.length * 11 + 18

  if (y + blockH > 792 - MARGIN) {
    doc.addPage()
    y = MARGIN
    header()
  }

  doc.setDrawColor(...BORDER).setLineWidth(0.5)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 16

  doc.setFont('courier', 'bold').setFontSize(9).setTextColor(...GOLD)
  doc.text(`SCENE ${s.n}`, MARGIN, y)
  doc.setFont('courier', 'normal').setFontSize(9).setTextColor(...MUTED)
  doc.text(`${s.tc}   ${s.dur}`, MARGIN + 78, y)
  y += 14

  doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(...MUTED)
  doc.text(onscreenLines, MARGIN, y)
  y += onscreenLines.length * 11 + 6

  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...INK)
  doc.text(bodyLines, MARGIN, y)
  y += bodyLines.length * 14 + 12
}

// Full-script page, read straight through
doc.addPage()
y = MARGIN
header()
doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...INK)
doc.text('Full script — read straight through', MARGIN, y)
y += 24

doc.setFont('helvetica', 'italic').setFontSize(9.5).setTextColor(...MUTED)
doc.text('(Scene 1 — 3s silence, no line)', MARGIN, y)
y += 22

doc.setFont('helvetica', 'normal').setFontSize(12).setTextColor(...INK)
for (const s of scenes.slice(1)) {
  const lines = doc.splitTextToSize(naira(s.vo), CONTENT_W)
  if (y + lines.length * 16 > 792 - MARGIN) {
    doc.addPage()
    y = MARGIN
    header()
  }
  doc.text(lines, MARGIN, y)
  y += lines.length * 16 + 14
}

const buffer = Buffer.from(doc.output('arraybuffer'))
const outPath = new URL('./15-voiceover-script-for-recording.pdf', import.meta.url)
writeFileSync(outPath, buffer)
console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
