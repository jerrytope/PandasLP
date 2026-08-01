// August "new month" graphic — reworked after feedback that the panda mascot illustration read
// as childish and disconnected from the rest of the composition. Dropped the illustration
// entirely rather than force an image in; the only image now is the real brand monogram
// (lib/logoDataLight.ts), same mark used in the certificate-style launch graphic. Centered,
// professional composition — typography and the ribbon tag carry the page instead of a picture.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../lib/logoDataLight.ts', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const cinzel = readFileSync(new URL('./cinzel-900.ttf', import.meta.url))
const dmMono = readFileSync(new URL('./dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('./inter-400.ttf', import.meta.url))

const SIZE = 1080

const VOID = '#141F2B'
const GOLD = '#D6BB80'
const GOLD_DIM = 'rgba(214,187,128,0.4)'
const TEXT_1 = '#F3EFE3'
const MUTED = '#8FAEC6'
const RED = '#E63946'

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
  { style: { width: '100%', height: '100%', display: 'flex', background: VOID, position: 'relative', overflow: 'hidden' } },

  h('div', { style: { position: 'absolute', top: 26, left: 26, right: 26, bottom: 26, border: `1px solid ${GOLD_DIM}`, display: 'flex' } }),
  h('div', { style: { position: 'absolute', top: 34, left: 34, right: 34, bottom: 34, border: `1px solid rgba(214,187,128,0.2)`, display: 'flex' } }),
  h(Corner, { corner: 'tl' }), h(Corner, { corner: 'tr' }), h(Corner, { corner: 'bl' }), h(Corner, { corner: 'br' }),

  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '0 90px' } },

    h('img', { src: LOGO_DATA_URI, width: 108, height: 71, alt: '', style: { marginBottom: 34 } }),

    // Ribbon tag — solid fill pennant with a pointed tail, not a bordered rectangle
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', transform: 'rotate(-3deg)', marginBottom: 40 } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', background: RED, padding: '9px 8px 9px 18px' } },
        h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: '#141F2B', fontWeight: 500, letterSpacing: '0.2em' } }, 'NEW MONTH'),
      ),
      h('div', {
        style: {
          display: 'flex', width: 0, height: 0,
          borderTop: '15px solid transparent', borderBottom: '15px solid transparent', borderLeft: `12px solid ${RED}`,
        },
      }),
    ),

    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 118, color: GOLD, letterSpacing: '0.01em', lineHeight: 1 } }, 'AUGUST.'),

    h('span', {
      style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 30, color: TEXT_1, letterSpacing: '0.01em', textAlign: 'center', lineHeight: 1.4, marginTop: 32, maxWidth: 660 },
    }, 'WHOEVER STILL OWES YOU FROM JULY DOESN’T GET A FRESH START TOO.'),

    h('span', {
      style: { display: 'flex', fontFamily: 'Inter', fontSize: 19, color: MUTED, marginTop: 26, textAlign: 'center', maxWidth: 460, lineHeight: 1.55 },
    }, 'Welcome to August. Let’s make this the month you finally get paid.'),

    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 40, marginBottom: 6 } },
      h('div', { style: { display: 'flex', width: 90, height: 1, background: GOLD_DIM } }),
      h('div', { style: { display: 'flex', width: 6, height: 6, background: GOLD, transform: 'rotate(45deg)' } }),
      h('div', { style: { display: 'flex', width: 90, height: 1, background: GOLD_DIM } }),
    ),

    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.08em' } }, 'FROM N10,000'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD_DIM } }, '·'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.08em' } }, 'NO RETAINER'),
    ),
  ),

  h(
    'div',
    { style: { position: 'absolute', bottom: 62, display: 'flex', width: '100%', justifyContent: 'center' } },
    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 21, color: TEXT_1, letterSpacing: '0.02em' } }, 'PANDASLP.COM.NG'),
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
const outPath = new URL('./pandas-lp-august.png', import.meta.url)
writeFileSync(outPath, buffer)
console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
