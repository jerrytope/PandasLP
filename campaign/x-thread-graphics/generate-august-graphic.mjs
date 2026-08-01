// August "new month" graphic — different composition from the launch-day seal card on purpose
// (variety across the campaign's graphic series), and the first one in this campaign to use a
// real illustrated image rather than pure typography: the existing panda mascot artwork
// (public/panda-hero.svg, rasterized via sharp — see rasterize-panda.mjs) bled off the bottom
// edge as a hero character moment. Red is pulled directly from the mascot's own tie color and
// used exactly once (same "scarcity" rule the brand's own concept doc sets for accent colors),
// not introduced arbitrarily.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const cinzel = readFileSync(new URL('./cinzel-900.ttf', import.meta.url))
const dmMono = readFileSync(new URL('./dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('./inter-400.ttf', import.meta.url))
const pandaPng = readFileSync(new URL('./panda-mascot.png', import.meta.url))
const PANDA_URI = `data:image/png;base64,${pandaPng.toString('base64')}`

const SIZE = 1080

const VOID = '#141F2B'
const GOLD = '#D6BB80'
const GOLD_DIM = 'rgba(214,187,128,0.4)'
const TEXT_1 = '#F3EFE3'
const MUTED = '#8FAEC6'
const RED = '#E63946'

const element = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', background: VOID, position: 'relative', overflow: 'hidden' } },

  // Panda mascot, bled off the bottom-right edge — a hero character moment, not a centered icon
  h('img', {
    src: PANDA_URI,
    width: 480,
    height: 561,
    style: { position: 'absolute', bottom: -60, right: 40, opacity: 0.96 },
  }),
  // Soft dark scrim behind the type column so headline stays legible over the busy illustration
  h('div', {
    style: {
      position: 'absolute', inset: 0,
      background: 'linear-gradient(100deg, #141F2B 0%, #141F2B 46%, rgba(20,31,43,0.0) 78%)',
      display: 'flex',
    },
  }),

  // Content column
  h(
    'div',
    { style: { position: 'relative', display: 'flex', flexDirection: 'column', padding: '86px 0 0 78px', width: 720 } },

    // The one red moment on the page — pulled from the mascot's own tie
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${RED}`, borderRadius: 3, padding: '7px 14px', alignSelf: 'flex-start' } },
      h('span', { style: { display: 'flex', width: 6, height: 6, background: RED, borderRadius: '50%' } }),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: RED, letterSpacing: '0.22em' } }, 'NEW MONTH'),
    ),

    h('span', {
      style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 128, color: GOLD, letterSpacing: '0.01em', lineHeight: 1, marginTop: 30 },
    }, 'AUGUST.'),

    h('span', {
      style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 33, color: TEXT_1, letterSpacing: '0.01em', lineHeight: 1.35, marginTop: 26, maxWidth: 560 },
    }, 'WHOEVER STILL OWES YOU FROM JULY DOESN’T GET A FRESH START TOO.'),

    h('span', {
      style: { display: 'flex', fontFamily: 'Inter', fontSize: 18, color: MUTED, marginTop: 26, maxWidth: 460, lineHeight: 1.55 },
    }, 'Tell the Small Claims Court Agent what happened. Ten minutes later you have a court-ready Letter of Demand.'),

    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 40 } },
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.08em' } }, 'FROM N10,000'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD_DIM } }, '·'),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.08em' } }, 'NO RETAINER'),
    ),
  ),

  h(
    'div',
    { style: { position: 'absolute', bottom: 44, left: 78, display: 'flex' } },
    h('span', { style: { display: 'flex', fontFamily: 'Cinzel', fontSize: 20, color: TEXT_1, letterSpacing: '0.03em' } }, 'PANDASLP.COM.NG'),
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
