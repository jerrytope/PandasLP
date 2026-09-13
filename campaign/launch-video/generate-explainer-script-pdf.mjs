// Renders 17-small-claims-explainer-script.md as a clean PDF — same layout as the VO script PDF
// (generate-vo-script-pdf.mjs) so the two production docs match.
import { jsPDF } from 'jspdf'
import { readFileSync, writeFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../lib/logoData.js', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const naira = (s) => s.replace(/₦/g, 'N')

const scenes = [
  {
    n: 1, title: 'The Problem', tc: '0:00–0:15',
    visual: 'WhatsApp thread ("I\'ll pay you next week") ticking to months later; a N450,000 deposit receipt stamped "NO DELIVERY. NO REFUND."; an unpaid invoice. Reuses existing scene1.png / scene2-fixed.png — no new shoot.',
    onscreen: 'HE SAID NEXT WEEK. THAT WAS MONTHS AGO.',
    vo: 'Someone owes you money. A loan they stopped repaying. An invoice they\'re ignoring. A deposit they took and never delivered on. The traditional fix is a lawyer\'s retainer — fifty thousand naira and up, days of back-and-forth, before anything is even drafted. For a small claim, that math rarely makes sense. So most people just let it go.',
  },
  {
    n: 2, title: 'The Small Claims Agent Demo', tc: '0:15–0:35',
    visual: 'Real screen recording (already captured this session, not a mockup) — chat interface, a receipt upload, the client typing their story, the agent asking sharp follow-up questions before drafting anything.',
    onscreen: 'STEP 1 — TELL YOUR STORY',
    vo: 'Describe what happened in your own words. Upload the WhatsApp thread, the receipt, the invoice — whatever you have. The agent reads it, asks exactly what\'s still missing, and checks whether what you\'ve got actually holds up — before a single document gets drafted.',
  },
  {
    n: 3, title: 'Why the Demand Letter Comes First', tc: '0:35–0:50',
    visual: 'The actual drafted Notice of Demand, gold "REVIEWED" stamp. Reuses scene7-fixed.png or the real letter from this session\'s recording.',
    onscreen: 'LICENSED LAWYERS. EVERY TIME.',
    vo: 'Every case starts with a Notice of Demand — reviewed and signed by a licensed Pandas LP lawyer before it ever goes out. That signature is what turns "you\'ll pay me back" into a formal, on-record legal claim. It\'s usually the first sign a debtor gets that this is no longer just between the two of you.',
  },
  {
    n: 4, title: 'After Service: The Waiting Period', tc: '0:50–1:10',
    visual: 'The real dashboard — case card, the four-stage tracker: Paid -> Served -> Filed -> Judgment, current stage lit, a day counter.',
    onscreen: 'DAY 7 OF 14',
    vo: 'Once it\'s served, the clock starts: a fourteen-day response period, tracked automatically on your dashboard. We check in for you at day seven and again at day fourteen — no need to remember, no need to chase. You\'ll always know exactly where the case stands.',
  },
  {
    n: 5, title: 'Escalation', tc: '1:10–1:30',
    visual: 'The "Escalate to Court Filing" action, then the tracker resolving to Judgment.',
    onscreen: 'IF THEY STILL WON\'T PAY, WE ESCALATE.',
    vo: 'If fourteen days pass with no payment, one click compiles everything you\'ve built — the letter, the evidence, the timeline — and moves the case toward Small Claims Court filing, still guided by your lawyer. Judgment is the goal. Once it\'s obtained, enforcement is the next step Pandas LP is built to handle. This is a real law firm behind you — not a document generator.',
  },
]

const corrections = [
  'Dropped "80%+ of debtors settle without going to court" — this number appears nowhere in the codebase, and lib/agentCapabilities.ts explicitly documents that no accuracy/speed statistic has ever been measured for any agent. Scene 3 argues from the real legal mechanism instead. Confirmed with the founder before writing the rest of the script.',
  '"7 to 14 days" corrected to 14 days flat, with real Day 7 and Day 14 checkpoints — the actual implemented mechanism (RESPONSE_PERIOD_DAYS = 14), not the general industry range used in this project\'s own blog content.',
  'Dashboard stage names corrected to the real ones — Paid, Served, Filed, Judgment — confirmed against an actual screen recording of the live dashboard, not the brief\'s "Waiting Period / Court Escalation," which don\'t exist as states in the product.',
  '"Automatic Court Escalation" softened to "one click" — the Day 7/14 tracking is automatic; filing itself is still a client-triggered button, guided by a lawyer.',
  'Judgment Enforcement kept as a separate next step, not bundled in — it\'s a distinct agent, currently Coming Soon rather than live.',
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
  doc.text('Lead Product & Legal Strategist', PAGE_W - MARGIN, y + 12, { align: 'right' })
  y += 34
  doc.setDrawColor(...BORDER).setLineWidth(0.75)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 26
}

function ensureSpace(need) {
  if (y + need > 792 - MARGIN) {
    doc.addPage()
    y = MARGIN
    header()
  }
}

header()
doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...INK)
doc.text('Small Claims Agent — Video Explainer Script', MARGIN, y)
y += 22
doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED)
doc.text('~85 seconds, 5 scenes. 1:1 or 9:16, burned-in captions throughout.', MARGIN, y)
y += 30

for (const s of scenes) {
  const visualLines = doc.splitTextToSize(naira(s.visual), CONTENT_W)
  const voLines = doc.splitTextToSize(naira(s.vo), CONTENT_W)
  const blockH = 18 + 16 + visualLines.length * 11 + 14 + voLines.length * 14 + 26
  ensureSpace(blockH)

  doc.setDrawColor(...BORDER).setLineWidth(0.5)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 18

  doc.setFont('courier', 'bold').setFontSize(9).setTextColor(...GOLD)
  doc.text(`SCENE ${s.n} — ${s.title.toUpperCase()}`, MARGIN, y)
  doc.setFont('courier', 'normal').setFontSize(9).setTextColor(...MUTED)
  doc.text(s.tc, PAGE_W - MARGIN, y, { align: 'right' })
  y += 16

  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...MUTED)
  doc.text('VISUAL', MARGIN, y)
  y += 11
  doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(...INK)
  doc.text(visualLines, MARGIN, y)
  y += visualLines.length * 11 + 10

  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...MUTED)
  doc.text(`ON SCREEN: "${s.onscreen}"`, MARGIN, y)
  y += 14

  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...INK)
  doc.text(voLines, MARGIN, y)
  y += voLines.length * 14 + 14
}

// Corrections page
doc.addPage()
y = MARGIN
header()
doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...INK)
doc.text('Corrections made to the brief', MARGIN, y)
y += 24
doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK)
corrections.forEach((c, i) => {
  const lines = doc.splitTextToSize(`${i + 1}. ${naira(c)}`, CONTENT_W)
  ensureSpace(lines.length * 14 + 12)
  doc.text(lines, MARGIN, y)
  y += lines.length * 14 + 12
})

const buffer = Buffer.from(doc.output('arraybuffer'))
const outPath = new URL('./17-small-claims-explainer-script.pdf', import.meta.url)
writeFileSync(outPath, buffer)
console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
