// "We're live" launch-day graphic — rebuilt as a poster/seal composition rather than an
// info-card layout. A rectangular grid with header/footer rules reads as a webpage screenshot,
// not something you'd post; a badge/seal is the actual conventional device for signaling legal
// authority (emblems/seals read as institutional credibility — litigation and defense firms
// use this exact device), so the whole thing is built around one off-center medallion instead
// of a bordered card. Real brand type (Bricolage Grotesque / DM Mono / Inter) still embedded.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const bricolage = readFileSync(new URL('./bricolage-700.ttf', import.meta.url))
const dmMono = readFileSync(new URL('./dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('./inter-400.ttf', import.meta.url))

const WIDTH = 1200
const HEIGHT = 630

const VOID = '#141F2B'
const RING_BG = '#1B2C3C'
const GOLD = '#D6BB80'
const GOLD_DEEP = '#B9985F'
const TEXT_1 = '#F3EFE3'
const MUTED = '#8FAEC6'

function StampTag({ text, rotate, top, left }) {
  return h(
    'div',
    {
      style: {
        position: 'absolute', top, left, display: 'flex',
        transform: `rotate(${rotate}deg)`,
        border: `1.5px solid ${GOLD_DEEP}`, borderRadius: 4,
        padding: '8px 14px', background: 'rgba(20,31,43,0.4)',
      },
    },
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD, letterSpacing: '0.08em' } }, text),
  )
}

const element = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', background: VOID, position: 'relative', overflow: 'hidden' } },

  // Faint oversized ring, bled off-canvas top-left, for depth without a gradient-blob glow
  h('div', {
    style: {
      position: 'absolute', top: -260, left: -260, width: 620, height: 620, borderRadius: '50%',
      border: `1px solid rgba(214,187,128,0.14)`, display: 'flex',
    },
  }),

  // The seal — bled off the top-right corner, rotated slightly off-axis
  h(
    'div',
    {
      style: {
        position: 'absolute', top: -130, right: -90, width: 480, height: 480, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle at 35% 30%, ${RING_BG} 0%, #101A24 78%)`,
        border: `3px solid ${GOLD}`, transform: 'rotate(-6deg)',
      },
    },
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 40 } },
      h('span', { style: { display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 64, color: GOLD, letterSpacing: '0.02em' } }, 'PLP'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 13, color: MUTED, letterSpacing: '0.24em' } }, 'PANDAS LP'),
    ),
  ),

  // Ribbon banner draped across the seal's lower third
  h(
    'div',
    {
      style: {
        position: 'absolute', top: 268, right: -140, width: 460, display: 'flex', justifyContent: 'center',
        background: GOLD, padding: '10px 0', transform: 'rotate(-6deg)',
        boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
      },
    },
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 17, color: '#141F2B', fontWeight: 500, letterSpacing: '0.18em' } }, 'OPEN NOW'),
  ),

  // Headline block — dramatic scale jump between the two lines, slight hand-set rotation
  h(
    'div',
    { style: { position: 'absolute', left: 70, top: 128, display: 'flex', flexDirection: 'column', width: 660 } },
    h('span', {
      style: {
        display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 34, color: MUTED,
        letterSpacing: '-0.01em', transform: 'rotate(-1deg)', marginBottom: 2,
      },
    }, 'They owe you.'),
    h('span', {
      style: {
        display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 104, color: GOLD,
        letterSpacing: '-0.03em', lineHeight: 0.95, transform: 'rotate(-2deg)', marginLeft: -4,
      },
    }, 'We go'),
    h('span', {
      style: {
        display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 104, color: TEXT_1,
        letterSpacing: '-0.03em', lineHeight: 0.95, transform: 'rotate(-2deg)', marginLeft: -4, marginTop: -6,
      },
    }, 'after it.'),
    h('span', {
      style: {
        display: 'flex', fontFamily: 'Inter', fontSize: 17, color: MUTED, lineHeight: 1.5,
        marginTop: 22, maxWidth: 420,
      },
    }, 'A licensed Lagos law firm that recovers what you’re owed — live now.'),
  ),

  // Scattered stamp tags, loosely arranged, not a neat grid
  h(StampTag, { text: '10 MIN TO A DRAFTED LETTER', rotate: -3, top: 470, left: 70 }),
  h(StampTag, { text: 'LICENSED LAWYERS REVIEW EVERY LETTER', rotate: 2, top: 522, left: 108 }),
  h(StampTag, { text: 'FROM N10,000 · NO RETAINER', rotate: -2, top: 574, left: 70 }),

  // Footer mark, floating, no rule line
  h(
    'div',
    { style: { position: 'absolute', bottom: 34, right: 64, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
    h('span', { style: { display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 22, color: GOLD } }, 'PANDASLP.COM.NG'),
  ),
)

const image = new ImageResponse(element, {
  width: WIDTH,
  height: HEIGHT,
  fonts: [
    { name: 'Bricolage Grotesque', data: bricolage, weight: 700, style: 'normal' },
    { name: 'DM Mono', data: dmMono, weight: 500, style: 'normal' },
    { name: 'Inter', data: inter, weight: 400, style: 'normal' },
  ],
})
const buffer = Buffer.from(await image.arrayBuffer())
const outPath = new URL('./pandas-lp-launch-day.png', import.meta.url)
writeFileSync(outPath, buffer)
console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
