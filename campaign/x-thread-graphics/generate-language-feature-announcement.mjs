// Announcement graphic for the translation/read-aloud/dictation feature launch. Uses the
// site's CURRENT type system (Instrument Sans / Geist Mono) and navy/gold palette — same
// fonts already fetched for campaign/launch-video/explainer-frames/, reused here rather than
// the older Cinzel/DM Mono set the earlier (pre-rebrand) campaign graphics used.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'
import { IVORY, INK, MUTED as MUTED_T, GOLD as GOLD_T, GOLD_DIM as GOLD_DIM_T, PHOTO, PhotoBackdrop, cardStyle } from './lagos-bg.mjs'

const logoSrc = readFileSync(new URL('../../lib/logoData.js', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const FONT_DIR = new URL('../launch-video/explainer-frames/', import.meta.url)
const instrument700 = readFileSync(new URL('instrument-sans-700.ttf', FONT_DIR))
const instrument500 = readFileSync(new URL('instrument-sans-500.ttf', FONT_DIR))
const geistMono500 = readFileSync(new URL('geist-mono-500.ttf', FONT_DIR))
const FONTS = [
  { name: 'Instrument Sans', data: instrument700, weight: 700, style: 'normal' },
  { name: 'Instrument Sans', data: instrument500, weight: 500, style: 'normal' },
  { name: 'Geist Mono', data: geistMono500, weight: 500, style: 'normal' },
]

const W = 1080, H = 1080
const NAVY = IVORY
const GOLD = GOLD_T
const GOLD_DIM = GOLD_DIM_T
const TEXT_1 = INK
const MUTED = MUTED_T

const element = h(
  'div',
  { style: { width: W, height: H, display: 'flex', background: '#1A1A1A', position: 'relative', overflow: 'hidden', fontFamily: 'Instrument Sans' } },
  [
    h(PhotoBackdrop, { key: 'bg', photo: PHOTO.skyline }),

    h(
      'div',
      { key: 'wrap', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', padding: '0 60px' } },
      h('div', { key: 'card', style: { display: 'flex', flexDirection: 'column', padding: '64px 68px', gap: 26, ...cardStyle() } }, [
        h('div', { key: 'logo', style: { display: 'flex', alignItems: 'center', gap: 14 } }, [
          h('img', { key: 'i', src: LOGO_DATA_URI, width: 52, height: 34 }),
          h('span', { key: 't', style: { display: 'flex', fontSize: 20, fontWeight: 700, color: TEXT_1 } }, ['Pandas ', h('span', { key: 'lp', style: { color: GOLD } }, 'LP')]),
        ]),

        h('div', { key: 'body', style: { display: 'flex', flexDirection: 'column', gap: 20 } }, [
          h('span', { key: 'eyebrow', style: { display: 'flex', fontFamily: 'Geist Mono', fontSize: 16, color: GOLD, letterSpacing: '0.14em' } }, 'NOW LIVE'),
          h('span', { key: 'h1', style: { display: 'flex', fontSize: 54, fontWeight: 700, color: TEXT_1, lineHeight: 1.08, letterSpacing: '-0.02em' } }, 'Your case,'),
          h('span', { key: 'h2', style: { display: 'flex', fontSize: 54, fontWeight: 700, color: GOLD, lineHeight: 1.08, letterSpacing: '-0.02em' } }, 'in your language.'),
          h('span', { key: 'sub', style: { display: 'flex', fontSize: 20, color: MUTED, lineHeight: 1.5, maxWidth: 760 } },
            'Every document Pandas LP drafts can now be translated into Yoruba, Igbo, Hausa, or Nigerian Pidgin, read aloud, or dictated by voice instead of typed.'),
        ]),

        h('div', { key: 'chips', style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
          ['Yoruba', 'Igbo', 'Hausa', 'Pidgin', 'Read Aloud', 'Voice Dictation'].map((label) =>
            h('span', {
              key: label,
              style: { display: 'flex', fontFamily: 'Geist Mono', fontSize: 14, color: TEXT_1, letterSpacing: '0.04em', padding: '8px 15px', borderRadius: 24, border: `1px solid ${GOLD_DIM}`, background: '#F5F3F0' },
            }, label),
          )),

        h('div', { key: 'footer', style: { display: 'flex', alignItems: 'center', gap: 14, paddingTop: 18, borderTop: `1px solid ${GOLD_DIM}` } }, [
          h('div', { key: 'bar', style: { width: 32, height: 3, background: GOLD, display: 'flex' } }),
          h('span', { key: 'url', style: { display: 'flex', fontFamily: 'Geist Mono', fontSize: 16, color: MUTED, letterSpacing: '0.04em' } }, 'PANDASLP.COM.NG'),
        ]),
      ]),
    ),
  ],
)

const image = new ImageResponse(element, { width: W, height: H, fonts: FONTS })
const buffer = Buffer.from(await image.arrayBuffer())
writeFileSync(new URL('./pandas-lp-language-features.png', import.meta.url), buffer)
console.log('Wrote pandas-lp-language-features.png')
