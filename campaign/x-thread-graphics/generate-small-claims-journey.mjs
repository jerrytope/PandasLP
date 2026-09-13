// Generates a single "thread summary" graphic for the Small Claims Court X thread using
// next/og's ImageResponse — the exact same rendering path (Satori under the hood) already
// used for this site's own OG images (see app/opengraph-image.tsx), so the brand look stays
// consistent without pulling in a separate image-generation dependency.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'
import { IVORY, INK, GOLD as GOLD_T, PHOTO, PhotoBackdrop, cardStyle } from './lagos-bg.mjs'

// lib/logoData.js isn't require()-able from a plain Node script (it's TS-adjacent), so pull the
// data URI out of the source file directly rather than duplicating the base64 by hand.
const logoSrc = readFileSync(new URL('../../lib/logoData.js', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const WIDTH = 1200
const HEIGHT = 675

const BG = INK
const CARD_BG = '#F5F3F0'
const CARD_BORDER = '#D8D2C8'
const GOLD = GOLD_T
const TEXT_1 = INK
const MUTED = '#6B6B6B'

const steps = [
  { n: '01', label: 'Demand Letter' },
  { n: '02', label: 'File & Evidence' },
  { n: '03', label: 'Hearing' },
  { n: '04', label: 'Judgment' },
  { n: '05', label: 'Enforcement' },
]

function Step({ n, label }) {
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 176 } },
    h(
      'div',
      {
        style: {
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 16,
          padding: '20px 12px',
        },
      },
      h('span', { style: { display: 'flex', fontSize: 15, fontWeight: 700, color: GOLD, letterSpacing: '0.05em' } }, n),
      h('span', { style: { display: 'flex', fontSize: 17, fontWeight: 600, color: TEXT_1, textAlign: 'center' } }, label),
    ),
  )
}

function Arrow() {
  return h('span', { style: { display: 'flex', fontSize: 22, color: GOLD, margin: '0 6px' } }, '→')
}

const stepRow = []
steps.forEach((s, i) => {
  stepRow.push(h(Step, { key: s.n, n: s.n, label: s.label }))
  if (i < steps.length - 1) stepRow.push(h(Arrow, { key: 'arrow-' + i }))
})

const element = h(
  'div',
  { style: { width: '100%', height: '100%', display: 'flex', background: BG, position: 'relative' } },

  h(PhotoBackdrop, { photo: PHOTO.skyline }),

  // Ivory card, inset from the photo on all sides
  h(
    'div',
    {
      style: {
        position: 'absolute', top: 22, left: 22, right: 22, bottom: 22,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 56px', ...cardStyle(),
      },
    },

  // Header row
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14 } },
      h('img', { src: LOGO_DATA_URI, width: 73, height: 48, alt: '' }),
      h(
        'span',
        { style: { display: 'flex', fontSize: 24, fontWeight: 700, color: TEXT_1, letterSpacing: '-0.02em' } },
        'Pandas ',
        h('span', { style: { display: 'flex', color: GOLD } }, 'LP'),
      ),
    ),
    h(
      'span',
      { style: { display: 'flex', fontSize: 15, fontWeight: 600, color: MUTED, letterSpacing: '0.12em' } },
      'SMALL CLAIMS COURT',
    ),
  ),

  // Hero pull-quote
  h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
    h(
      'span',
      { style: { display: 'flex', fontSize: 56, fontWeight: 700, color: TEXT_1, lineHeight: 1.1, letterSpacing: '-0.02em' } },
      'A judgment is not the end.',
    ),
    h(
      'span',
      { style: { display: 'flex', fontSize: 56, fontWeight: 700, color: GOLD, lineHeight: 1.1, letterSpacing: '-0.02em' } },
      "It's leverage.",
    ),
  ),

  // The journey
  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } }, ...stepRow),

  // Footer CTA
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', gap: 16 } },
    h('div', { style: { width: 40, height: 3, background: GOLD, display: 'flex' } }),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
      h('span', { style: { display: 'flex', fontSize: 22, fontWeight: 700, color: GOLD, letterSpacing: '0.02em' } }, 'LIVE THURSDAY · 7PM WAT'),
      h(
        'span',
        { style: { display: 'flex', fontSize: 17, color: MUTED } },
        "A lawyer breaks down the full journey in plain English. Plus something new.",
      ),
    ),
  ),
  ),
)

const image = new ImageResponse(element, { width: WIDTH, height: HEIGHT })
const buffer = Buffer.from(await image.arrayBuffer())
const outPath = new URL('./small-claims-thread-journey.png', import.meta.url)
writeFileSync(outPath, buffer)
console.log('Wrote', outPath.pathname, buffer.length, 'bytes')
