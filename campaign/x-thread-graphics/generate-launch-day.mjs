// "We're live" launch-day announcement graphic — same next/og ImageResponse pipeline as
// generate-small-claims-journey.mjs, so the brand look stays consistent with the site's own
// OG images without pulling in a separate image-generation dependency or spending Higgsfield
// credits on something that's fundamentally a text/logo card, not a photoreal scene.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../lib/logoDataLight.ts', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const WIDTH = 1200
const HEIGHT = 630

const BG = '#182A3A'
const CARD_BG = '#1F3446'
const CARD_BORDER = 'rgba(214,187,128,0.25)'
const GOLD = '#D6BB80'
const TEXT_1 = '#F3EFE3'
const MUTED = '#ABB1A2'
const GREEN = '#3ECF8E'

const proofPoints = [
  { n: '10 MIN', label: 'AI interview' },
  { n: 'REAL LAWYERS', label: 'Review + serve' },
  { n: 'N10,000', label: 'To get started' }, // ₦ glyph isn't in Satori's base font and requires a network font fetch — see lib/pdfGenerator.js's normalizeForPdf() for the same tradeoff
]

function ProofPoint({ n, label }) {
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 200 } },
    h(
      'div',
      {
        style: {
          display: 'flex', width: '100%', flexDirection: 'column', alignItems: 'center', gap: 8,
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: '18px 12px',
        },
      },
      h('span', { style: { display: 'flex', fontSize: 20, fontWeight: 700, color: GOLD, letterSpacing: '0.02em' } }, n),
      h('span', { style: { display: 'flex', fontSize: 14, fontWeight: 500, color: MUTED, textAlign: 'center' } }, label),
    ),
  )
}

const element = h(
  'div',
  {
    style: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', background: BG, padding: '52px 64px', position: 'relative',
    },
  },
  h('div', {
    style: {
      position: 'absolute', top: -180, right: -140, width: 560, height: 560, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(214,187,128,0.30) 0%, rgba(214,187,128,0) 70%)', display: 'flex',
    },
  }),

  // Header
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14 } },
      h('img', { src: LOGO_DATA_URI, width: 73, height: 48, alt: '' }),
      h('span', { style: { display: 'flex', fontSize: 24, fontWeight: 700, color: TEXT_1, letterSpacing: '-0.02em' } },
        'Pandas ', h('span', { style: { display: 'flex', color: GOLD } }, 'LP')),
    ),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      h('span', { style: { display: 'flex', width: 9, height: 9, borderRadius: '50%', background: GREEN } }),
      h('span', { style: { display: 'flex', fontSize: 15, fontWeight: 700, color: GREEN, letterSpacing: '0.14em' } }, 'LIVE NOW'),
    ),
  ),

  // Headline
  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
    h('span', { style: { display: 'flex', fontSize: 52, fontWeight: 700, color: TEXT_1, lineHeight: 1.1, letterSpacing: '-0.02em' } },
      "Nigeria's first AI-native"),
    h('span', { style: { display: 'flex', fontSize: 52, fontWeight: 700, color: GOLD, lineHeight: 1.1, letterSpacing: '-0.02em' } },
      'law firm is open.'),
  ),

  // Proof points
  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 } },
    proofPoints.map((p, i) => h(ProofPoint, { key: p.n, ...p }))),

  // Footer CTA
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: 16 } },
    h('div', { style: { width: 40, height: 3, background: GOLD, display: 'flex' } }),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
      h('span', { style: { display: 'flex', fontSize: 22, fontWeight: 700, color: GOLD, letterSpacing: '0.02em' } }, 'PANDASLP.COM.NG'),
      h('span', { style: { display: 'flex', fontSize: 17, color: MUTED } },
        'AI drafts it in minutes. Real lawyers make it count.'),
    ),
  ),
)

const image = new ImageResponse(element, { width: WIDTH, height: HEIGHT })
const buffer = Buffer.from(await image.arrayBuffer())
const outPath = new URL('./pandas-lp-launch-day.png', import.meta.url)
writeFileSync(outPath, buffer)
console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
