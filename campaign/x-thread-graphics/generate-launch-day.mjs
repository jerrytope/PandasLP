// "We're live" launch-day graphic — a square (1080x1080) certificate/seal card, not the
// landscape info-card/poster shapes tried before. Certificates and legal seals are
// conventionally symmetric and centered with a thin double-line border and small corner
// ornaments (chunky/loud frames read cheap — keep it restrained), so this leans fully into
// that instead of dynamic asymmetry. Uses the actual brand monogram mark (lib/logoDataLight.ts,
// the same light PLP ligature used on the real site) rather than retyped "PLP" text.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'
import { IVORY, INK, MUTED as MUTED_T, GOLD as GOLD_T, GOLD_DIM as GOLD_DIM_T, PHOTO, PhotoBackdrop, cardStyle } from './lagos-bg.mjs'

const logoSrc = readFileSync(new URL('../../lib/logoData.js', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const cinzel = readFileSync(new URL('./cinzel-900.ttf', import.meta.url))
const dmMono = readFileSync(new URL('./dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('./inter-400.ttf', import.meta.url))

const SIZE = 1080

const VOID = IVORY
const GOLD = GOLD_T
const GOLD_DIM = GOLD_DIM_T
const TEXT_1 = INK
const MUTED = MUTED_T

// Small L-shaped corner ornament with a curled inner edge — safer to render than an embedded
// SVG flourish, still reads as an engraved-certificate corner rather than a plain frame.
function Corner({ corner }) {
  const pos = {
    tl: { top: 40, left: 40, borderTop: `1.5px solid ${GOLD}`, borderLeft: `1.5px solid ${GOLD}`, borderTopLeftRadius: 22 },
    tr: { top: 40, right: 40, borderTop: `1.5px solid ${GOLD}`, borderRight: `1.5px solid ${GOLD}`, borderTopRightRadius: 22 },
    bl: { bottom: 40, left: 40, borderBottom: `1.5px solid ${GOLD}`, borderLeft: `1.5px solid ${GOLD}`, borderBottomLeftRadius: 22 },
    br: { bottom: 40, right: 40, borderBottom: `1.5px solid ${GOLD}`, borderRight: `1.5px solid ${GOLD}`, borderBottomRightRadius: 22 },
  }[corner]
  return h('div', { style: { position: 'absolute', width: 56, height: 56, display: 'flex', ...pos } })
}

const element = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', background: INK, position: 'relative', overflow: 'hidden' } },

  h(PhotoBackdrop, { photo: PHOTO.skyline }),

  // Double-line certificate border, now framing the photo itself
  h('div', { style: { position: 'absolute', top: 26, left: 26, right: 26, bottom: 26, border: `1px solid ${GOLD_DIM}`, display: 'flex' } }),
  h('div', { style: { position: 'absolute', top: 34, left: 34, right: 34, bottom: 34, border: `1px solid rgba(184,134,11,0.3)`, display: 'flex' } }),

  h(Corner, { corner: 'tl' }), h(Corner, { corner: 'tr' }), h(Corner, { corner: 'bl' }), h(Corner, { corner: 'br' }),

  // Centering wrapper — the card itself carries the ivory surface, floated over the photo
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '0 56px' } },
  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 70px 44px', ...cardStyle() } },

    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD, letterSpacing: '0.32em' } }, 'CAC BN 9646741 · LAGOS'),

    // The seal ring, with the real logo mark inside — no retyped monogram text
    h(
      'div',
      {
        style: {
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
          width: 300, height: 300, borderRadius: '50%', marginTop: 44, marginBottom: 40,
          border: `1.5px solid ${GOLD}`, position: 'relative',
        },
      },
      h('div', { style: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 10, borderRadius: '50%', border: `1px solid rgba(214,187,128,0.35)`, display: 'flex' } }),
      h('img', { src: LOGO_DATA_URI, width: 168, height: 110, alt: '' }),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 13, color: MUTED, letterSpacing: '0.3em' } }, 'PANDAS LP'),
    ),

    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 30, color: TEXT_1, letterSpacing: '0.08em' } }, 'THEY OWE YOU.'),
    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 76, color: GOLD, letterSpacing: '0.02em', marginTop: 10, lineHeight: 1.15 } }, 'WE GO AFTER IT.'),

    h('span', {
      style: { display: 'flex', fontFamily: 'Inter', fontSize: 18, color: MUTED, marginTop: 22, textAlign: 'center', maxWidth: 520, lineHeight: 1.5 },
    }, 'A licensed Lagos law firm that recovers what you’re owed — open now.'),

    // Fine-print divider with a center diamond, then proof points as plain tracked text
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 40, marginBottom: 24 } },
      h('div', { style: { display: 'flex', width: 90, height: 1, background: GOLD_DIM } }),
      h('div', { style: { display: 'flex', width: 6, height: 6, background: GOLD, transform: 'rotate(45deg)' } }),
      h('div', { style: { display: 'flex', width: 90, height: 1, background: GOLD_DIM } }),
    ),

    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 16 } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD, letterSpacing: '0.08em' } }, '10 MIN'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD_DIM } }, '·'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD, letterSpacing: '0.08em' } }, 'LICENSED LAWYERS'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD_DIM } }, '·'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD, letterSpacing: '0.08em' } }, 'FROM N10,000'),
    ),

    // Sign-off, now part of the card rather than a separate overlay on the photo
    h(
      'div',
      { style: { display: 'flex', marginTop: 34, paddingTop: 22, width: '100%', justifyContent: 'center', borderTop: `1px solid ${GOLD_DIM}` } },
      h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 19, color: TEXT_1, letterSpacing: '0.01em' } }, 'PANDASLP.COM.NG'),
    ),
  ),
  ),
)

const image = new ImageResponse(element, {
  width: SIZE,
  height: SIZE,
  fonts: [
    { name: 'Cinzel', data: cinzel, weight: 900, style: 'normal' },
    { name: 'DM Mono', data: dmMono, weight: 500, style: 'normal' },
    { name: 'Inter', data: inter, weight: 400, style: 'normal' },
  ],
})
const buffer = Buffer.from(await image.arrayBuffer())
const outPath = new URL('./pandas-lp-launch-day.png', import.meta.url)
writeFileSync(outPath, buffer)
console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
