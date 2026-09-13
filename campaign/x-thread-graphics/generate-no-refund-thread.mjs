// Header graphic for the "no refund" emotional thread (campaign/launch-video/11). Visual
// metaphor: the actual dismissive "slip of paper" from the thread, rendered as a torn receipt
// card, contrasted with the counter-line — then the Space info as the CTA, since this thread
// doubles as anticipation for tonight. Same type system as the launch-day seal card (Cinzel /
// DM Mono / Inter) for a consistent graphic "series" across the campaign.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'
import { IVORY, INK as INK_T, MUTED as MUTED_T, GOLD as GOLD_T, GOLD_DIM as GOLD_DIM_T, PHOTO, PhotoBackdrop, cardStyle } from './lagos-bg.mjs'

const cinzel = readFileSync(new URL('./cinzel-900.ttf', import.meta.url))
const dmMono = readFileSync(new URL('./dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('./inter-400.ttf', import.meta.url))

const SIZE = 1080

const VOID = IVORY
const GOLD = GOLD_T
const GOLD_DIM = GOLD_DIM_T
const TEXT_1 = INK_T
const MUTED = MUTED_T
const PAPER = '#EDE6D3'
const INK = '#1F1A12'

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
  { style: { width: '100%', height: '100%', display: 'flex', background: '#1A1A1A', position: 'relative', overflow: 'hidden' } },

  h(PhotoBackdrop, { photo: PHOTO.market }),

  h('div', { style: { position: 'absolute', top: 26, left: 26, right: 26, bottom: 26, border: `1px solid ${GOLD_DIM}`, display: 'flex' } }),
  h('div', { style: { position: 'absolute', top: 34, left: 34, right: 34, bottom: 34, border: `1px solid rgba(184,134,11,0.3)`, display: 'flex' } }),
  h(Corner, { corner: 'tl' }), h(Corner, { corner: 'tr' }), h(Corner, { corner: 'bl' }), h(Corner, { corner: 'br' }),

  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '0 50px' } },
  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 60px 40px', ...cardStyle() } },

    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.3em' } }, 'SOUND FAMILIAR?'),

    // The "slip" — a torn-receipt card, slightly rotated, holding the dismissive line verbatim
    h(
      'div',
      {
        style: {
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          background: PAPER, color: INK, width: 620, padding: '30px 40px 24px',
          marginTop: 40, marginBottom: 40, transform: 'rotate(-2deg)',
          borderBottom: `3px dashed rgba(31,26,18,0.35)`,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        },
      },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 12, color: 'rgba(31,26,18,0.55)', letterSpacing: '0.2em' } }, 'WHAT THEY TELL YOU'),
      h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 38, letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.3, marginTop: 6 } }, '"WE DON’T REFUND.'),
      h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 38, letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.3 } }, 'PICK SOMETHING ELSE."'),
    ),

    // Counter-line
    h('span', {
      style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 44, color: GOLD, letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.25, maxWidth: 720 },
    }, 'THAT WAS NEVER THE END OF IT.'),

    h('span', {
      style: { display: 'flex', fontFamily: 'Inter', fontSize: 18, color: MUTED, marginTop: 20, textAlign: 'center', maxWidth: 540, lineHeight: 1.55 },
    }, 'If a vendor kept your money and blamed the policy, the Small Claims Court Agent fights back for you.'),

    // Divider
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14, marginTop: 38, marginBottom: 26 } },
      h('div', { style: { display: 'flex', width: 90, height: 1, background: GOLD_DIM } }),
      h('div', { style: { display: 'flex', width: 6, height: 6, background: GOLD, transform: 'rotate(45deg)' } }),
      h('div', { style: { display: 'flex', width: 90, height: 1, background: GOLD_DIM } }),
    ),

    // Space info CTA
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.2em' } }, 'SEE HOW IT WORKS — LIVE'),
      h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 26, color: TEXT_1, letterSpacing: '0.04em', marginTop: 4 } }, 'TONIGHT · 7:00 PM WAT'),
    ),

    h(
      'div',
      { style: { display: 'flex', marginTop: 30, paddingTop: 20, width: '100%', justifyContent: 'center', borderTop: `1px solid ${GOLD_DIM}` } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: MUTED, letterSpacing: '0.12em' } }, 'PANDASLP.COM.NG'),
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
const outPath = new URL('./pandas-lp-no-refund-thread.png', import.meta.url)
writeFileSync(outPath, buffer)
console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
