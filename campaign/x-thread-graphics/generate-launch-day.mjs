// "We're live" launch-day announcement graphic — same next/og ImageResponse pipeline as
// generate-small-claims-journey.mjs, but rebuilt as a letterhead/dossier composition instead
// of a generic SaaS-launch card: no gradient glow, no row of equal rounded stat tiles. Uses
// the site's real type system (Bricolage Grotesque / Inter / DM Mono, same as app/layout.jsx)
// embedded directly so this doesn't fall back to a generic sans face.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../lib/logoDataLight.ts', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const bricolage = readFileSync(new URL('./bricolage-700.ttf', import.meta.url))
const dmMono = readFileSync(new URL('./dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('./inter-400.ttf', import.meta.url))

const WIDTH = 1200
const HEIGHT = 630

const VOID = '#182A3A'
const GOLD = '#D6BB80'
const TEXT_1 = '#F3EFE3'
const MUTED = '#8FAEC6'
const LINE = 'rgba(214,187,128,0.3)'

const exhibits = [
  { tag: '10 MIN', copy: 'to a drafted letter' },
  { tag: 'LICENSED LAWYERS', copy: 'review and serve every letter' },
  { tag: 'FROM N10,000', copy: 'no retainer' },
]

function ExhibitRow({ tag, copy }) {
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'baseline', gap: 18, borderTop: `1px solid ${LINE}`, padding: '14px 0' } },
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 15, color: GOLD, letterSpacing: '0.06em', width: 210, flexShrink: 0 } }, tag),
    h('span', { style: { display: 'flex', fontFamily: 'Inter', fontSize: 16, color: MUTED } }, copy),
  )
}

const element = h(
  'div',
  {
    style: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', background: VOID, padding: '56px 68px',
    },
  },

  // Header — wordmark left, plain status mark right (no badge/pill)
  h(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 28, borderBottom: `1px solid ${LINE}` } },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14 } },
      h('img', { src: LOGO_DATA_URI, width: 62, height: 41, alt: '' }),
      h('span', { style: { display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 21, color: TEXT_1, letterSpacing: '-0.01em' } },
        'Pandas ', h('span', { style: { display: 'flex', color: GOLD } }, 'LP')),
    ),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 9 } },
      h('span', { style: { display: 'flex', width: 7, height: 7, borderRadius: '50%', background: GOLD } }),
      h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 14, color: GOLD, letterSpacing: '0.14em' } }, 'OPEN NOW'),
    ),
  ),

  // Body — headline left, dossier list right
  h(
    'div',
    { style: { display: 'flex', flex: 1, alignItems: 'center', gap: 56, paddingTop: 12 } },
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 14, flex: '1 1 0', minWidth: 0 } },
      h('span', { style: { display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 58, color: TEXT_1, lineHeight: 1.05, letterSpacing: '-0.02em' } }, 'They owe you.'),
      h('span', { style: { display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 58, color: GOLD, lineHeight: 1.05, letterSpacing: '-0.02em' } }, 'We go after it.'),
      h('span', { style: { display: 'flex', fontFamily: 'Inter', fontSize: 18, color: MUTED, lineHeight: 1.5, marginTop: 8, maxWidth: 420 } },
        'A licensed Lagos law firm that recovers what you’re owed.'),
    ),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', flex: '0 0 380px' } },
      exhibits.map((e) => h(ExhibitRow, { key: e.tag, ...e })),
    ),
  ),

  // Footer — letterhead sign-off
  h(
    'div',
    { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 24, borderTop: `1px solid ${LINE}` } },
    h('span', { style: { display: 'flex', fontFamily: 'Bricolage Grotesque', fontSize: 22, color: GOLD, letterSpacing: '0.01em' } }, 'PANDASLP.COM.NG'),
    h('span', { style: { display: 'flex', fontFamily: 'Inter', fontSize: 15, color: MUTED } }, 'Demand letter today. Court in 14 days if it’s ignored.'),
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
