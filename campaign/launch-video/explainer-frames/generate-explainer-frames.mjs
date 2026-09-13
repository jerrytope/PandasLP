// Static frames for the explainer video's UI/typography scenes (1, 3, 4, 5, 6, 8) — these are
// screen/interface moments that AI photoreal video handles badly (garbled text), so they're
// built the same way the campaign graphics are: real DOM/CSS rendered to an image via Satori.
// ffmpeg then animates each with a slow pan/zoom so it reads as video, not a slide.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../../lib/logoDataLight.ts', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const cinzel = readFileSync(new URL('../../x-thread-graphics/cinzel-900.ttf', import.meta.url))
const dmMono = readFileSync(new URL('../../x-thread-graphics/dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('../../x-thread-graphics/inter-400.ttf', import.meta.url))
const FONTS = [
  { name: 'Cinzel', data: cinzel, weight: 900, style: 'normal' },
  { name: 'DM Mono', data: dmMono, weight: 500, style: 'normal' },
  { name: 'Inter', data: inter, weight: 400, style: 'normal' },
]

const W = 1280, H = 720

function CaptionBar({ text }) {
  return h(
    'div',
    { style: { position: 'absolute', left: 0, right: 0, bottom: 48, display: 'flex', justifyContent: 'center' } },
    h(
      'div',
      { style: { display: 'flex', background: 'rgba(10,15,22,0.82)', borderRadius: 8, padding: '12px 26px', border: '1px solid rgba(214,187,128,0.25)' } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 18, color: TEXT_1, letterSpacing: '0.04em' } }, text),
    ),
  )
}
const VOID = '#182A3A'
const CARD = '#1F3446'
const CARD2 = '#28455A'
const GOLD = '#D6BB80'
const GOLD_DIM = 'rgba(214,187,128,0.4)'
const TEXT_1 = '#F3EFE3'
const MUTED = '#8FAEC6'
const GREEN = '#3ECF8E'

// ── Scene 1: the phone / WhatsApp hook ──
const scene1 = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1620', position: 'relative' } },
  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: 380, background: CARD, borderRadius: 28, border: '1px solid rgba(214,187,128,0.2)', padding: '28px 22px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' } },
    h('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: 22 } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 12, color: MUTED, letterSpacing: '0.1em' } }, '3 MONTHS AGO')),
    h('div', { style: { display: 'flex', background: '#2A5546', borderRadius: '14px 14px 4px 14px', padding: '14px 18px', alignSelf: 'flex-end', maxWidth: 300 } },
      h('span', { style: { display: 'flex', fontFamily: 'Inter', fontSize: 18, color: TEXT_1 } }, "I'll pay you next week, I promise.")),
    h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: 6 } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 12, color: MUTED } }, 'Seen ✓✓')),
  ),
  h(CaptionBar, { text: 'HE SAID NEXT WEEK. THAT WAS MONTHS AGO.' }),
)

// ── Scene 3: the turn — Pandas LP interface reveal ──
const scene3 = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: VOID } },
  h('img', { src: LOGO_DATA_URI, width: 120, height: 79, alt: '' }),
  h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 42, color: TEXT_1, letterSpacing: '0.02em', marginTop: 26 } }, 'PANDAS LP'),
  h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.2em', marginTop: 14 } }, 'YOUR AI LEGAL TEAM'),
)

// ── Scene 4: chat interface mockup ──
function Bubble({ ai, text }) {
  return h('div', {
    style: {
      display: 'flex', maxWidth: 460, padding: '14px 18px', borderRadius: ai ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
      background: ai ? CARD2 : GOLD, color: ai ? TEXT_1 : '#182A3A', fontFamily: 'Inter', fontSize: 17,
      alignSelf: ai ? 'flex-start' : 'flex-end', lineHeight: 1.4,
    },
  }, text)
}
const scene4 = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0d1620', padding: '50px 120px', position: 'relative' } },
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 30 } },
    h('span', { style: { display: 'flex', width: 8, height: 8, borderRadius: '50%', background: GREEN } }),
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: MUTED, letterSpacing: '0.1em' } }, 'PANDAS LP · SMALL CLAIMS AGENT')),
  h('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    h(Bubble, { ai: true, text: 'Who owes you money, and what was it for?' }),
    h(Bubble, { ai: false, text: 'He took my N450,000 deposit and never delivered.' }),
    h(Bubble, { ai: true, text: 'Do you have a receipt or messages confirming the payment?' }),
  ),
  h(CaptionBar, { text: 'STEP 1 — TELL YOUR STORY' }),
)

// ── Scene 5: pricing tiers ──
function Tier({ price, label, selected }) {
  return h(
    'div',
    {
      style: {
        display: 'flex', flexDirection: 'column', gap: 10, width: 300, padding: '30px 26px', borderRadius: 16,
        background: selected ? CARD2 : CARD, border: selected ? `2px solid ${GOLD}` : '1px solid rgba(214,187,128,0.2)',
      },
    },
    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 32, color: selected ? GOLD : TEXT_1 } }, price),
    h('span', { style: { display: 'flex', fontFamily: 'Inter', fontSize: 16, color: MUTED } }, label),
  )
}
const scene5 = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30, background: VOID, position: 'relative' } },
  h(Tier, { price: 'N10,000', label: 'Serve it yourself', selected: false }),
  h(Tier, { price: 'N25,000', label: 'We serve it for you', selected: true }),
  h(CaptionBar, { text: 'STEP 2 — CHOOSE YOUR TIER' }),
)

// ── Scene 6: dashboard progress rail ──
function Stage({ label, active }) {
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 200 } },
    h('div', { style: { display: 'flex', width: 22, height: 22, borderRadius: '50%', background: active ? GREEN : 'rgba(255,255,255,0.15)' } }),
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 13, color: active ? TEXT_1 : MUTED, letterSpacing: '0.08em' } }, label),
  )
}
const scene6 = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1620', position: 'relative' } },
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center' } },
    h(Stage, { label: 'PAID', active: true }),
    h('div', { style: { display: 'flex', width: 60, height: 2, background: GREEN, marginTop: -30 } }),
    h(Stage, { label: 'SERVED', active: true }),
    h('div', { style: { display: 'flex', width: 60, height: 2, background: 'rgba(255,255,255,0.15)', marginTop: -30 } }),
    h(Stage, { label: 'FILED', active: false }),
    h('div', { style: { display: 'flex', width: 60, height: 2, background: 'rgba(255,255,255,0.15)', marginTop: -30 } }),
    h(Stage, { label: 'JUDGMENT', active: false }),
  ),
  h(CaptionBar, { text: 'STEP 3 — TRACK YOUR CASE' }),
)

// ── Scene 8: CTA ──
const scene8 = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0f16' } },
  h('img', { src: LOGO_DATA_URI, width: 96, height: 63, alt: '', style: { marginBottom: 30 } }),
  h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 36, color: TEXT_1, textAlign: 'center', letterSpacing: '0.01em' } }, 'THEY OWE YOU.'),
  h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 36, color: GOLD, textAlign: 'center', letterSpacing: '0.01em', marginTop: 4 } }, 'WE GO AFTER IT.'),
  h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 16, color: MUTED, marginTop: 26, letterSpacing: '0.1em' } }, 'PANDASLP.COM.NG'),
)

async function render(element, outName) {
  const image = new ImageResponse(element, { width: W, height: H, fonts: FONTS })
  const buffer = Buffer.from(await image.arrayBuffer())
  writeFileSync(new URL(`./${outName}`, import.meta.url), buffer)
  console.log('Wrote', outName)
}

await render(scene1, 'scene1.png')
await render(scene3, 'scene3.png')
await render(scene4, 'scene4.png')
await render(scene5, 'scene5.png')
await render(scene6, 'scene6.png')
await render(scene8, 'scene8.png')
