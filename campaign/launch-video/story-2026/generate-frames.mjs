// Frames for the debt-recovery brand film.
//
// Scope is deliberately narrow: this is about money someone owes you and the
// Small Claims Court process that gets it back. Property law is not in it.
//
// Rendered as real DOM/CSS through Satori (the path already used by
// campaign/x-thread-graphics and app/opengraph-image.tsx), so type is crisp and
// nothing is AI-generated. assemble.sh times each frame to its voiceover line.
//
// Not reusing campaign/launch-video/explainer-frames: that set is built on the
// retired navy palette and its photoreal clips cannot be re-graded.
//
// Run:  node campaign/launch-video/story-2026/generate-frames.mjs

import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'

const here = (p) => new URL(p, import.meta.url)

// google/fonts ships Playfair Display and Source Sans 3 as VARIABLE fonts only, and
// Satori cannot parse an fvar table. These are static instances: Playfair as WOFF from
// fontsource, Source Sans as OTF from Adobe upstream, Plex Mono as TTF from google/fonts.
const FONTS = [
  { name: 'Playfair', data: readFileSync(here('./fonts/fs-playfair.woff')), weight: 500, style: 'normal' },
  { name: 'Playfair', data: readFileSync(here('./fonts/fs-playfair-italic.woff')), weight: 500, style: 'italic' },
  { name: 'Sans', data: readFileSync(here('./fonts/adobe-sans.otf')), weight: 400, style: 'normal' },
  { name: 'Sans', data: readFileSync(here('./fonts/adobe-sans-600.otf')), weight: 600, style: 'normal' },
  { name: 'Mono', data: readFileSync(here('./fonts/mono-400.ttf')), weight: 400, style: 'normal' },
]

// Palette lifted from the live site's :root block.
const IVORY = '#FAFAF8'
const PAPER = '#F5F3F0'
const WHITE = '#FFFFFF'
const INK = '#1A1A1A'
const DARK = '#141414'
const GOLD = '#B8860B'
const GOLD_L = '#D4A84B'
const MUTED = '#6B6B6B'
const FAINT = '#9A968D'
const RULE = '#E8E4DF'

const W = 1920, H = 1080
const PAD = 140

const logoSrc = readFileSync(here('../../../lib/logoData.js'), 'utf8')
const LOGO = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

/* ── shared ──────────────────────────────────────────────── */

const stage = (children, bg = IVORY) =>
  h('div', {
    style: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: bg, padding: `${PAD}px`,
    },
  }, ...children)

const lockup = (light = false, scale = 1) =>
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 20 * scale } },
    h('img', { src: LOGO, width: 76 * scale, height: 50 * scale }),
    h('div', { style: { display: 'flex', width: 1, height: 44 * scale, background: light ? 'rgba(250,250,248,0.3)' : '#D8D2C8' } }),
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 30 * scale, letterSpacing: `${2.4 * scale}px`, color: light ? IVORY : INK } }, 'PANDAS'),
      h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 12 * scale, letterSpacing: `${5 * scale}px`, color: light ? 'rgba(250,250,248,0.55)' : FAINT, marginTop: 6 * scale } }, 'LEGAL PRACTITIONERS'),
    ),
  )

const statement = (lines, light = false, size = 94) =>
  h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' } },
    ...lines.map((l, i) =>
      h('div', {
        key: i,
        style: {
          display: 'flex', fontFamily: 'Playfair', fontSize: l.size || size,
          lineHeight: 1.08, letterSpacing: '-2.5px',
          color: l.gold ? (light ? GOLD_L : GOLD) : (light ? IVORY : INK),
          fontStyle: l.italic ? 'italic' : 'normal',
        },
      }, l.t),
    ),
  )

const foot = (text, light = false) =>
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
    h('div', { style: { display: 'flex', width: 44, height: 1, background: light ? GOLD_L : GOLD } }),
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 17, letterSpacing: '2px', color: light ? 'rgba(250,250,248,0.6)' : MUTED } }, text),
  )

/* ── the SCC interview ───────────────────────────────────── */

const TURNS = [
  { who: 'ai', t: 'Who owes you money, and what was it for?' },
  { who: 'you', t: 'my business partner. we did a construction job together and he took the client payment but never paid my share. about ₦1.2 million' },
  { who: 'ai', t: 'Was there a written partnership agreement, or was the arrangement verbal?' },
  { who: 'you', t: 'verbal. but we have whatsapp messages where he agreed to the 50/50 split' },
  { who: 'ai', t: 'Those messages are admissible, so that helps. I should be straight with you: a verbal partnership with no written terms is contestable if he disputes the percentage.' },
]

const bubble = (turn, i) => {
  const mine = turn.who === 'you'
  return h('div', {
    key: i,
    style: { display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', width: '100%' },
  },
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 13, letterSpacing: '2px', color: FAINT, marginBottom: 10 } }, mine ? 'YOU' : 'PANDAS LP'),
    h('div', {
      style: {
        display: 'flex', maxWidth: 960, padding: '22px 26px', fontFamily: 'Sans', fontSize: 26, lineHeight: 1.45,
        background: mine ? INK : PAPER, color: mine ? IVORY : INK,
      },
    }, turn.t),
  )
}

const chatFrame = (upTo) =>
  stage([
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 } },
      h('div', { style: { display: 'flex', width: 10, height: 10, borderRadius: 5, background: GOLD } }),
      h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 15, letterSpacing: '3px', color: MUTED } }, 'SMALL CLAIMS COURT AGENT'),
    ),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 24, flexGrow: 1 } },
      ...TURNS.slice(0, upTo).map(bubble),
    ),
  ])

/* ── the letter ──────────────────────────────────────────── */

const letterFrame = (signed) =>
  stage([
    h('div', { style: { display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' } },
      h('div', {
        style: {
          display: 'flex', flexDirection: 'column', width: 1060, background: WHITE,
          border: `1px solid ${RULE}`, padding: '52px 60px',
        },
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 18, borderBottom: `2px solid ${INK}` } },
          h('img', { src: LOGO, width: 58, height: 38 }),
          h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 22, letterSpacing: '2px', color: INK } }, 'PANDAS LP'),
        ),
        h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 14, letterSpacing: '1.5px', color: FAINT, marginTop: 24 } }, 'WITHOUT PREJUDICE'),
        h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 30, lineHeight: 1.3, color: INK, marginTop: 14 } }, 'RE: LETTER OF DEMAND'),
        h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 22, lineHeight: 1.6, color: '#4A4A48', marginTop: 24 } },
          'We are Solicitors to our Client, on whose instructions we write to demand the sum of ₦1,200,000.00 withheld since 14 June 2026.'),
        h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 22, lineHeight: 1.6, color: '#4A4A48', marginTop: 16 } },
          'TAKE NOTICE that failure to comply within fourteen (14) days shall leave our Client with no alternative than to institute legal proceedings.'),
        signed
          ? h('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 30, paddingTop: 20, borderTop: `1px solid ${RULE}` } },
              // Placeholder on purpose: this is a specimen letter in a public film, so it carries
              // no real practitioner name. Swap for whoever actually signs before publishing.
              h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 34, fontStyle: 'italic', color: FAINT } }, '[ practitioner signature ]'),
              h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 13, letterSpacing: '1.6px', color: FAINT, marginTop: 8 } }, 'FOR: PANDAS LP  ·  REVIEWING PRACTITIONER'),
            )
          : h('div', { style: { display: 'flex', marginTop: 30, paddingTop: 20, borderTop: `1px solid ${RULE}`, fontFamily: 'Mono', fontSize: 14, letterSpacing: '2px', color: FAINT } }, 'AWAITING PRACTITIONER REVIEW'),
      ),
    ),
  ])

/* ── the fourteen day clock, built up one step at a time ─── */

const CLOCK = [
  { d: '00', t: 'Signed and served on the debtor' },
  { d: '07', t: 'A firmer notice goes out' },
  { d: '14', t: 'The statutory window closes' },
  { d: '15', t: 'We file at the Small Claims Court' },
]

const clockFrame = (upTo) =>
  stage([
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 15, letterSpacing: '4px', color: GOLD, marginBottom: 34 } }, 'THE FOURTEEN DAY CLOCK'),
    h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 60, letterSpacing: '-1.6px', color: INK, marginBottom: 54 } }, 'Then the chasing is ours.'),
    h('div', { style: { display: 'flex', width: '100%', borderTop: `1px solid ${INK}` } },
      ...CLOCK.map((c, i) => {
        const on = i < upTo
        const live = i === upTo - 1
        return h('div', {
          key: i,
          style: {
            display: 'flex', flexDirection: 'column', flexGrow: 1, flexBasis: 0,
            padding: '32px 32px 0 0',
            borderRight: i < 3 ? `1px solid ${RULE}` : '0px solid transparent',
          },
        },
          h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 80, lineHeight: 1, color: on ? (live ? GOLD : INK) : '#E2DED7' } }, c.d),
          h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 13, letterSpacing: '3px', color: on ? (live ? GOLD : FAINT) : '#E2DED7', marginTop: 14 } }, 'DAY'),
          h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 23, lineHeight: 1.4, color: on ? MUTED : '#E2DED7', marginTop: 16 } }, c.t),
        )
      }),
    ),
  ])

/* ── cost comparison ─────────────────────────────────────── */

const compareFrame = () =>
  stage([
    h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 60, letterSpacing: '-1.6px', color: INK, marginBottom: 52 } }, 'What this normally costs.'),
    h('div', { style: { display: 'flex', width: '100%', flexGrow: 1, borderTop: `2px solid ${INK}` } },
      h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, flexBasis: 0, padding: '34px 48px 0 0', borderRight: `1px solid ${RULE}` } },
        h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 14, letterSpacing: '3px', color: FAINT, marginBottom: 22 } }, 'A TRADITIONAL FIRM'),
        h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 46, color: MUTED, marginBottom: 18 } }, 'A retainer.'),
        h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 25, lineHeight: 1.5, color: MUTED } }, 'Then an hourly rate you cannot forecast, and a bill that arrives after the work.'),
      ),
      h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, flexBasis: 0, padding: '34px 0 0 48px' } },
        h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 14, letterSpacing: '3px', color: GOLD, marginBottom: 22 } }, 'PANDAS LP'),
        h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 46, color: INK, marginBottom: 18 } }, '₦10,000.'),
        h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 25, lineHeight: 1.5, color: '#4A4A48' } }, 'Quoted before you start. You read the draft before you pay for it.'),
      ),
    ),
  ])

/* ── frames ──────────────────────────────────────────────── */

const FRAMES = [
  ['01-open', stage([
    statement([{ t: 'Someone owes you money.' }, { t: 'And they have stopped replying.', italic: true }]),
    foot('DEBT RECOVERY  ·  LAGOS, NIGERIA'),
  ])],

  ['02-firm', stage([
    h('div', { style: { display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'center' } },
      lockup(false, 1.5),
      h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 62, letterSpacing: '-1.6px', color: INK, marginTop: 54 } }, 'A Lagos law firm built to go'),
      h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 62, letterSpacing: '-1.6px', color: GOLD, fontStyle: 'italic' } }, 'and get it back.'),
    ),
    foot('CAC BN 9646741'),
  ])],

  ['03-chat1', chatFrame(1)],
  ['04-chat2', chatFrame(2)],
  ['05-chat3', chatFrame(3)],
  ['06-chat4', chatFrame(4)],
  ['07-chat5', chatFrame(5)],

  ['08-letter', letterFrame(false)],
  ['09-letter-signed', letterFrame(true)],

  ['10-gate', stage([
    statement([{ t: 'Nothing leaves this office' }, { t: 'unsigned.', italic: true, gold: true }], true, 86),
    foot('EVERY DOCUMENT REVIEWED BY A LICENSED PRACTITIONER', true),
  ], DARK)],

  ['11-day0', clockFrame(1)],
  ['12-day7', clockFrame(2)],
  ['13-day14', clockFrame(3)],
  ['14-day15', clockFrame(4)],

  ['15-court', stage([
    statement([{ t: 'And a Pandas LP lawyer' }, { t: 'appears for you.', italic: true, gold: true }], true, 82),
    foot('SMALL CLAIMS COURT, LAGOS STATE', true),
  ], DARK)],

  ['16-enforcement', stage([
    statement([{ t: 'Winning is not the same' }, { t: 'as being paid.', italic: true }]),
    foot('JUDGMENT ENFORCEMENT IS THE NEXT FILE WE OPEN'),
  ])],

  ['17-compare', compareFrame()],

  ['18-price', stage([
    statement([{ t: '₦10,000.' }, { t: 'Quoted before you start.', italic: true }]),
    foot('NO RETAINER  ·  NO HOURLY RATE'),
  ])],

  ['19-end', stage([
    h('div', { style: { display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'center' } },
      h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 74, letterSpacing: '-2px', color: IVORY } }, 'Ten minutes of your time.'),
      h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 74, letterSpacing: '-2px', color: GOLD_L, fontStyle: 'italic' } }, 'We take it from there.'),
      h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 26, letterSpacing: '4px', color: IVORY, marginTop: 50 } }, 'PANDASLP.COM.NG'),
    ),
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' } },
      lockup(true),
      h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 16, letterSpacing: '2px', color: 'rgba(250,250,248,0.55)' } }, 'CAC BN 9646741'),
    ),
  ], DARK)],
]

/* ── render ──────────────────────────────────────────────── */

mkdirSync(here('./frames/'), { recursive: true })

for (const [name, element] of FRAMES) {
  const res = new ImageResponse(element, { width: W, height: H, fonts: FONTS })
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(new URL(`./frames/${name}.png`, import.meta.url), buf)
  console.log(`  ${name}.png  ${(buf.length / 1024).toFixed(0)}KB`)
}

console.log(`\n${FRAMES.length} frames at ${W}x${H}`)
