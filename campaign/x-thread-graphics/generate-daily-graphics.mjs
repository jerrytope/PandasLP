// Two graphics for today's posts, same Satori pipeline as the rest of the series (Higgsfield
// is disconnected right now, so no photographic option today). Graphic A: Pandas LP's "Did You
// Know" evidence tip, matching the certificate-series look. Graphic B: a personal quote card for
// the founder's own X post — deliberately simpler/less ornate than the brand series, since it's
// a personal post, not official Pandas LP collateral.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../lib/logoDataLight.ts', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const cinzel = readFileSync(new URL('./cinzel-900.ttf', import.meta.url))
const dmMono = readFileSync(new URL('./dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('./inter-400.ttf', import.meta.url))
const FONTS = [
  { name: 'Cinzel', data: cinzel, weight: 900, style: 'normal' },
  { name: 'DM Mono', data: dmMono, weight: 500, style: 'normal' },
  { name: 'Inter', data: inter, weight: 400, style: 'normal' },
]

const SIZE = 1080
const VOID = '#141F2B'
const GOLD = '#D6BB80'
const GOLD_DIM = 'rgba(214,187,128,0.4)'
const TEXT_1 = '#F3EFE3'
const MUTED = '#8FAEC6'

function Corner({ corner }) {
  const pos = {
    tl: { top: 40, left: 40, borderTop: `1.5px solid ${GOLD}`, borderLeft: `1.5px solid ${GOLD}`, borderTopLeftRadius: 22 },
    tr: { top: 40, right: 40, borderTop: `1.5px solid ${GOLD}`, borderRight: `1.5px solid ${GOLD}`, borderTopRightRadius: 22 },
    bl: { bottom: 40, left: 40, borderBottom: `1.5px solid ${GOLD}`, borderLeft: `1.5px solid ${GOLD}`, borderBottomLeftRadius: 22 },
    br: { bottom: 40, right: 40, borderBottom: `1.5px solid ${GOLD}`, borderRight: `1.5px solid ${GOLD}`, borderBottomRightRadius: 22 },
  }[corner]
  return h('div', { style: { position: 'absolute', width: 56, height: 56, display: 'flex', ...pos } })
}

// ── Graphic A: Pandas LP "Did You Know" evidence tip ──────────────────────────
const graphicA = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', background: VOID, position: 'relative', overflow: 'hidden' } },
  h('div', { style: { position: 'absolute', top: 26, left: 26, right: 26, bottom: 26, border: `1px solid ${GOLD_DIM}`, display: 'flex' } }),
  h('div', { style: { position: 'absolute', top: 34, left: 34, right: 34, bottom: 34, border: `1px solid rgba(214,187,128,0.2)`, display: 'flex' } }),
  h(Corner, { corner: 'tl' }), h(Corner, { corner: 'tr' }), h(Corner, { corner: 'bl' }), h(Corner, { corner: 'br' }),

  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '0 100px' } },
    h('img', { src: LOGO_DATA_URI, width: 90, height: 59, alt: '', style: { marginBottom: 30 } }),
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD, letterSpacing: '0.3em' } }, 'DID YOU KNOW'),
    h('span', {
      style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 56, color: TEXT_1, letterSpacing: '0.01em', textAlign: 'center', lineHeight: 1.25, marginTop: 26, maxWidth: 760 },
    }, 'A WHATSAPP MESSAGE CAN BE THE EVIDENCE THAT WINS YOUR CASE.'),
    h('span', {
      style: { display: 'flex', fontFamily: 'Inter', fontSize: 19, color: MUTED, marginTop: 28, textAlign: 'center', maxWidth: 520, lineHeight: 1.55 },
    }, 'A message where someone admits they owe you is admissible evidence under Nigerian law. Screenshot it before you do anything else.'),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 44, marginBottom: 6 } },
      h('div', { style: { display: 'flex', width: 90, height: 1, background: GOLD_DIM } }),
      h('div', { style: { display: 'flex', width: 6, height: 6, background: GOLD, transform: 'rotate(45deg)' } }),
      h('div', { style: { display: 'flex', width: 90, height: 1, background: GOLD_DIM } }),
    ),
  ),
  h(
    'div',
    { style: { position: 'absolute', bottom: 62, display: 'flex', width: '100%', justifyContent: 'center' } },
    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 20, color: TEXT_1, letterSpacing: '0.02em' } }, 'PANDASLP.COM.NG'),
  ),
)

// ── Graphic B: personal quote card, deliberately simpler than the brand series ──
const graphicB = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: VOID, padding: '0 96px' } },
  h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 22, color: GOLD_DIM, marginBottom: 34 } }, '“'),
  h('span', {
    style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 44, color: TEXT_1, lineHeight: 1.4, letterSpacing: '0.01em' },
  }, 'I got tired of watching people eat a loss they were legally owed, just because doing something about it cost more than the debt itself.'),
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 46 } },
    h('div', { style: { display: 'flex', width: 40, height: 1.5, background: GOLD } }),
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.08em' } }, 'ADEBAYO SOBAYO — FOUNDER OF PANDAS LP'),
  ),
)

// ── Graphic C: LinkedIn quote card, landscape (LinkedIn displays wide images best) ──
const graphicC = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: VOID, padding: '0 110px' } },
  h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 22, color: GOLD_DIM, marginBottom: 26 } }, '“'),
  h('span', {
    style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 38, color: TEXT_1, lineHeight: 1.4, letterSpacing: '0.01em', maxWidth: 880 },
  }, 'How fast and how cheap you can deliver a service has far more to do with the process than with how complicated the problem actually is.'),
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 36 } },
    h('div', { style: { display: 'flex', width: 40, height: 1.5, background: GOLD } }),
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.08em' } }, 'ADEBAYO SOBAYO — FOUNDER OF PANDAS LP'),
  ),
)

async function render(element, outName, width = SIZE, height = SIZE) {
  const image = new ImageResponse(element, { width, height, fonts: FONTS })
  const buffer = Buffer.from(await image.arrayBuffer())
  const outPath = new URL(`./${outName}`, import.meta.url)
  writeFileSync(outPath, buffer)
  console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
}

await render(graphicA, 'pandas-lp-daily-evidence-tip.png')
await render(graphicB, 'personal-quote-card.png')
await render(graphicC, 'linkedin-quote-card.png', 1200, 630)
