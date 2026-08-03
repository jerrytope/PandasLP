// Static frames for the Small Claims Agent explainer (see ../13-small-claims-video-script.md).
// Covers only the beats that are NOT real screen capture and NOT Higgsfield cinematic
// generation: title cards, subtitle/text-overlay graphics, and the Act 5 end card — same
// Satori (next/og) approach as ../generate-explainer-frames.mjs, reused here with the site's
// current type system (Instrument Sans / Geist Mono) instead of the older Cinzel/DM Mono/Inter
// combination those earlier frames used.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../../lib/logoDataLight.ts', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const instrument700 = readFileSync(new URL('./instrument-sans-700.ttf', import.meta.url))
const instrument500 = readFileSync(new URL('./instrument-sans-500.ttf', import.meta.url))
const geistMono500 = readFileSync(new URL('./geist-mono-500.ttf', import.meta.url))
const FONTS = [
  { name: 'Instrument Sans', data: instrument700, weight: 700, style: 'normal' },
  { name: 'Instrument Sans', data: instrument500, weight: 500, style: 'normal' },
  { name: 'Geist Mono', data: geistMono500, weight: 500, style: 'normal' },
]

const W = 1920, H = 1080

const NAVY = '#182A3A'
const CARD = '#1F3446'
const CARD2 = '#28455A'
const GOLD = '#D6BB80'
const TEXT_1 = '#F3EFE3'
const MUTED = '#8FAEC6'

// Lower-third subtitle bar — reused across every scene per the video script's placement spec.
function LowerThird({ text, size = 34 }) {
  return h(
    'div',
    { style: { position: 'absolute', left: 0, right: 0, bottom: 90, display: 'flex', justifyContent: 'center', padding: '0 160px' } },
    h(
      'div',
      { style: { display: 'flex', background: 'rgba(24,42,58,0.88)', borderRadius: 10, padding: '20px 40px', border: `1px solid rgba(214,187,128,0.28)` } },
      h('span', { style: { display: 'flex', fontFamily: 'Instrument Sans', fontWeight: 500, fontSize: size, color: TEXT_1, textAlign: 'center', lineHeight: 1.35 } }, text),
    ),
  )
}

// Top-left step tag — reused for Act 4's STEP 1-4 beats.
function StepTag({ label }) {
  return h(
    'div',
    { style: { position: 'absolute', top: 64, left: 100, display: 'flex' } },
    h('span', { style: { display: 'flex', fontFamily: 'Geist Mono', fontWeight: 500, fontSize: 22, color: GOLD, letterSpacing: '0.08em' } }, label),
  )
}

// ── Act 1 — Small Claims Court title card (0:00-0:04) ──
const act1Title = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: NAVY, position: 'relative' } },
  h('span', { style: { display: 'flex', fontFamily: 'Instrument Sans', fontWeight: 700, fontSize: 84, color: GOLD, letterSpacing: '0.01em', textAlign: 'center' } }, 'SMALL CLAIMS COURT'),
  h(LowerThird, { text: 'Resolves monetary claims and unpaid debts under N5,000,000 — without a long trial.', size: 32 }),
)

// ── Act 2 — Problem subtitle cards (0:10-0:20), overlaid on cinematic B-roll in the edit ──
const act2CardA = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', background: 'transparent', position: 'relative' } },
  h(LowerThird, { text: 'Unpaid invoices. Unreturned deposits. Debtors who stop answering.', size: 38 }),
)
const act2CardB = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', background: 'transparent', position: 'relative' } },
  h(LowerThird, { text: 'Most people never chase it. The traditional route costs too much and takes too long.', size: 30 }),
)

// ── Act 3 — Agent intro title card (0:24-0:28) ──
const act3Title = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: NAVY, position: 'relative' } },
  h('img', { src: LOGO_DATA_URI, width: 140, height: 92, alt: '' }),
  h('span', { style: { display: 'flex', fontFamily: 'Instrument Sans', fontWeight: 700, fontSize: 68, color: GOLD, marginTop: 30, letterSpacing: '0.01em' } }, 'PANDAS LP'),
  h(LowerThird, { text: 'The Small Claims Court Agent. Instant. 24/7. Drafts your Demand Letter and court forms.', size: 32 }),
)

// ── Act 4 — Step overlays (composited over real screen-capture footage in the edit) ──
function stepOverlay(label, text, size = 30) {
  return h(
    'div',
    { style: { width: '100%', height: '100%', display: 'flex', background: 'transparent', position: 'relative' } },
    h(StepTag, { label }),
    h(LowerThird, { text, size }),
  )
}
const step1 = stepOverlay('STEP 1', 'Answer a few plain-English questions. Upload your proof — invoice, receipt, chat screenshot.')
const step2 = stepOverlay('STEP 2', "A court-ready Demand Letter — Form SCA 1 — generated in minutes. Reviewed by a licensed lawyer before it's ever sent.", 28)
const step3 = stepOverlay('STEP 3', 'Served. Then a 14-day response window, tracked automatically — Day 0, Day 7, Day 14.')
const step4 = stepOverlay('STEP 4', "If they still won't pay: court filing, then judgment enforcement. You don't chase anyone.", 30)

// ── Act 5 — End card / CTA (1:14-1:22) ──
const act5EndCard = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: NAVY } },
  h('img', { src: LOGO_DATA_URI, width: 110, height: 72, alt: '', style: { marginBottom: 34 } }),
  h('span', { style: { display: 'flex', fontFamily: 'Instrument Sans', fontWeight: 700, fontSize: 56, color: GOLD, letterSpacing: '0.01em' } }, 'PANDASLP.COM.NG'),
  h('span', { style: { display: 'flex', fontFamily: 'Geist Mono', fontWeight: 500, fontSize: 24, color: MUTED, marginTop: 30, letterSpacing: '0.04em' } },
    'N10,000 self-serve  ·  N25,000 served  ·  CAC BN 9646741'),
)

async function render(element, outName) {
  const image = new ImageResponse(element, { width: W, height: H, fonts: FONTS })
  const buffer = Buffer.from(await image.arrayBuffer())
  writeFileSync(new URL(`./${outName}`, import.meta.url), buffer)
  console.log('Wrote', outName)
}

await render(act1Title, 'sc-act1-title.png')
await render(act2CardA, 'sc-act2-card-a.png')
await render(act2CardB, 'sc-act2-card-b.png')
await render(act3Title, 'sc-act3-title.png')
await render(step1, 'sc-step1-overlay.png')
await render(step2, 'sc-step2-overlay.png')
await render(step3, 'sc-step3-overlay.png')
await render(step4, 'sc-step4-overlay.png')
await render(act5EndCard, 'sc-act5-endcard.png')
