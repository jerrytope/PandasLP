// Replaces scenes 2 and 7 — the only two scenes still built as AI-generated video, and the
// only two with the garbled-fake-text artifact (a receipt and a letter, both with illegible
// nonsense copy baked into the frame by the video model). Same fix already applied to scenes
// 1/3/4/5/6/8: render the moment as a real Satori card instead of asking a video model to
// invent readable text. For scene 7's letter body, grey placeholder bars stand in for text
// instead of fake sentences — the standard honest way to suggest "a document" without
// rendering words that were never actually written.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const cinzel = readFileSync(new URL('../../x-thread-graphics/cinzel-900.ttf', import.meta.url))
const dmMono = readFileSync(new URL('../../x-thread-graphics/dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('../../x-thread-graphics/inter-400.ttf', import.meta.url))
const FONTS = [
  { name: 'Cinzel', data: cinzel, weight: 900, style: 'normal' },
  { name: 'DM Mono', data: dmMono, weight: 500, style: 'normal' },
  { name: 'Inter', data: inter, weight: 400, style: 'normal' },
]

const W = 1280, H = 720
const VOID = '#182A3A'
const CARD = '#1F3446'
const GOLD = '#D6BB80'
const GOLD_DIM = 'rgba(214,187,128,0.4)'
const TEXT_1 = '#F3EFE3'
const MUTED = '#8FAEC6'
const RED = '#E0665A'
const PAPER = '#EDE6D3'
const INK = '#1F1A12'

function CaptionBar({ text }) {
  return h(
    'div',
    { style: { position: 'absolute', left: 0, right: 0, bottom: 48, display: 'flex', justifyContent: 'center' } },
    h(
      'div',
      { style: { display: 'flex', background: 'rgba(10,15,22,0.82)', borderRadius: 8, padding: '12px 26px', border: `1px solid ${GOLD_DIM}` } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 18, color: TEXT_1, letterSpacing: '0.04em' } }, text),
    ),
  )
}

// ── Scene 2 replacement: the problem, stated in real numbers instead of a fake receipt ──
// Reuses the exact ₦450,000 figure scene 4 introduces later in the video — not a new invented
// amount, just the same example shown earlier as "here's what this looks like before Pandas LP."
const scene2 = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1620', position: 'relative' } },
  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, width: 520, background: CARD, borderRadius: 20, border: `1px solid ${GOLD_DIM}`, padding: '44px 40px', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' } },
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 13, color: MUTED, letterSpacing: '0.2em' } }, 'DEPOSIT RECEIPT'),
    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 52, color: TEXT_1, letterSpacing: '0.01em' } }, 'N450,000'),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 20, background: 'rgba(224,102,90,0.14)', border: `1px solid rgba(224,102,90,0.4)` } },
      h('span', { style: { display: 'flex', width: 8, height: 8, borderRadius: '50%', background: RED } }),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: RED, letterSpacing: '0.08em' } }, 'NO DELIVERY. NO REFUND.'),
    ),
  ),
  h(CaptionBar, { text: 'SOUND FAMILIAR?' }),
)

// ── Scene 7 replacement: the letter, reviewed — placeholder bars stand in for body text ──
function TextBar({ width }) {
  return h('div', { style: { display: 'flex', width, height: 11, borderRadius: 3, background: 'rgba(31,26,18,0.16)' } })
}
const scene7 = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: VOID, position: 'relative' } },
  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: 460, background: PAPER, borderRadius: 6, padding: '40px 44px', gap: 14, boxShadow: '0 40px 90px rgba(0,0,0,0.55)', position: 'relative' } },
    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 19, color: INK, letterSpacing: '0.04em', marginBottom: 6 } }, 'NOTICE OF DEMAND'),
    h(TextBar, { width: 360 }),
    h(TextBar, { width: 330 }),
    h(TextBar, { width: 370 }),
    h(TextBar, { width: 220 }),
    h('div', { style: { display: 'flex', marginTop: 18 } }, h(TextBar, { width: 150 })),
    // Reviewed stamp, overlapping the bottom-right corner
    h(
      'div',
      {
        style: {
          display: 'flex', alignItems: 'center', gap: 8, position: 'absolute', bottom: -22, right: -18,
          background: '#1F3446', border: `1.5px solid ${GOLD}`, borderRadius: 30, padding: '10px 20px',
          transform: 'rotate(-6deg)', boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
        },
      },
      h('span', { style: { display: 'flex', color: GOLD, fontSize: 16, fontWeight: 700 } }, '✓'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 13, color: TEXT_1, letterSpacing: '0.1em' } }, 'REVIEWED'),
    ),
  ),
  h('span', {
    style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: MUTED, letterSpacing: '0.12em', position: 'absolute', bottom: 100 },
  }, 'SIGNED — LICENSED PANDAS LP LAWYER'),
  h(CaptionBar, { text: 'LICENSED LAWYERS. EVERY TIME.' }),
)

async function render(element, outName) {
  const image = new ImageResponse(element, { width: W, height: H, fonts: FONTS })
  const buffer = Buffer.from(await image.arrayBuffer())
  writeFileSync(new URL(`./${outName}`, import.meta.url), buffer)
  console.log('Wrote', outName)
}

await render(scene2, 'scene2-fixed.png')
await render(scene7, 'scene7-fixed.png')
