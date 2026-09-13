// Day 2 of the 7-day Instagram launch plan — "Meet Pandas LP" brand-reveal carousel, 6 slides.
// Ivory/gold system (the live site's current brand), Cinzel/DM Mono/Inter — same type family as
// the rest of this campaign folder (explainer video, other graphics) rather than introducing a
// third font system, since Playfair Display ships only as a variable font upstream and Satori
// can't load variable fonts (confirmed: throws on load).
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { readFileSync, writeFileSync } from 'fs'
import { IVORY, INK, MUTED as MUTED_T, GOLD as GOLD_T, GOLD_DIM as GOLD_DIM_T, BORDER, BORDER_STRONG } from './lagos-bg.mjs'

const logoSrc = readFileSync(new URL('../../lib/logoData.js', import.meta.url), 'utf8')
const LOGO_DATA_URI = logoSrc.match(/'(data:image\/png;base64[^']+)'/)[1]

const cinzel = readFileSync(new URL('./cinzel-900.ttf', import.meta.url))
const dmMono = readFileSync(new URL('./dmmono-500.ttf', import.meta.url))
const inter = readFileSync(new URL('./inter-400.ttf', import.meta.url))
const FONTS = [
  { name: 'Cinzel', data: cinzel, weight: 900, style: 'normal' },
  { name: 'DM Mono', data: dmMono, weight: 500, style: 'normal' },
  { name: 'Inter', data: inter, weight: 400, style: 'normal' },
]

const W = 1080, H = 1350
const GOLD = GOLD_T, GOLD_DIM = GOLD_DIM_T, INK1 = INK, MUTED = MUTED_T

function Base(children) {
  return h('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: IVORY, position: 'relative', overflow: 'hidden' } }, children)
}
function Corner({ corner }) {
  const pos = {
    tl: { top: 36, left: 36, borderTop: `1.5px solid ${GOLD}`, borderLeft: `1.5px solid ${GOLD}`, borderTopLeftRadius: 18 },
    tr: { top: 36, right: 36, borderTop: `1.5px solid ${GOLD}`, borderRight: `1.5px solid ${GOLD}`, borderTopRightRadius: 18 },
    bl: { bottom: 36, left: 36, borderBottom: `1.5px solid ${GOLD}`, borderLeft: `1.5px solid ${GOLD}`, borderBottomLeftRadius: 18 },
    br: { bottom: 36, right: 36, borderBottom: `1.5px solid ${GOLD}`, borderRight: `1.5px solid ${GOLD}`, borderBottomRightRadius: 18 },
  }[corner]
  return h('div', { style: { position: 'absolute', width: 48, height: 48, display: 'flex', ...pos } })
}
function Corners() { return [h(Corner,{key:'tl',corner:'tl'}), h(Corner,{key:'tr',corner:'tr'}), h(Corner,{key:'bl',corner:'bl'}), h(Corner,{key:'br',corner:'br'})] }
function PageDots(active) {
  return h('div', { style: { position: 'absolute', bottom: 44, display: 'flex', width: '100%', justifyContent: 'center', gap: 8 } },
    [1,2,3,4,5,6].map((n) => h('div', { key: n, style: { display:'flex', width: n===active?22:7, height: 7, borderRadius: 4, background: n===active?GOLD:GOLD_DIM } })))
}

// Slide 1 — wordmark reveal
const slide1 = Base([
  ...Corners(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%' } },
    h('img', { src: LOGO_DATA_URI, width: 130, height: 86, alt: '' }),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 52, color: INK1, letterSpacing:'0.04em', marginTop: 26 } }, 'PANDAS LP'),
    h('div', { style: { display:'flex', width: 90, height: 2, background: GOLD, marginTop: 20 } }),
  ),
  PageDots(1),
])

// Slide 2 — hero headline, verbatim from the live site
const slide2 = Base([
  ...Corners(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', justifyContent:'center', width:'100%', height:'100%', padding:'0 84px' } },
    h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 14, color: GOLD, letterSpacing:'0.3em', marginBottom: 26 } }, 'NIGERIA · AI-NATIVE LEGAL SERVICES'),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 58, color: INK1, letterSpacing:'0.01em', lineHeight: 1.25 } }, 'The fastest way'),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 58, color: GOLD, letterSpacing:'0.01em', lineHeight: 1.25, marginBottom: 26 } }, 'to get legal help'),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 58, color: INK1, letterSpacing:'0.01em', lineHeight: 1.25 } }, 'in Nigeria.'),
  ),
  PageDots(2),
])

// Slide 3 — CAC badge, real registration
const slide3 = Base([
  ...Corners(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', padding:'0 90px' } },
    h('div', { style: { display:'flex', alignItems:'center', gap: 10, padding:'10px 22px', borderRadius: 30, border: `1px solid ${GOLD_DIM}`, marginBottom: 30 } },
      h('span', { style: { display:'flex', width: 7, height: 7, borderRadius: 4, background: GOLD } }),
      h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 15, color: INK1, letterSpacing:'0.14em' } }, 'CAC BN 9646741 · LAGOS'),
    ),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 44, color: INK1, textAlign:'center', lineHeight: 1.3 } }, 'A registered business.'),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 44, color: GOLD, textAlign:'center', lineHeight: 1.3, marginBottom: 22 } }, 'Not a chatbot.'),
    h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 18, color: MUTED, textAlign:'center', maxWidth: 560, lineHeight: 1.6 } }, 'Licensed lawyers review, serve, and file every document before it reaches anyone.'),
  ),
  PageDots(3),
])

// Slides 4 & 5 — the two-step model (AI drafts, lawyer reviews)
function StepSlide({ eyebrow, title, sub, n }) {
  return Base([
    ...Corners(),
    h('div', { key:'body', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', padding:'0 90px' } },
      h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 15, color: GOLD, letterSpacing:'0.3em', marginBottom: 22 } }, eyebrow),
      h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 46, color: INK1, textAlign:'center', lineHeight: 1.3, maxWidth: 640 } }, title),
      h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 18, color: MUTED, textAlign:'center', maxWidth: 540, lineHeight: 1.6, marginTop: 22 } }, sub),
    ),
    PageDots(n),
  ])
}
const slide4 = StepSlide({ eyebrow: 'STEP ONE', title: 'AI does the first layer', sub: 'Describe your problem in plain English. A specialist agent structures the facts and drafts the document.', n: 4 })
const slide5 = StepSlide({ eyebrow: 'STEP TWO', title: 'A lawyer reviews everything', sub: 'Nothing is sent, served, or filed until a licensed Pandas LP lawyer has checked it.', n: 5 })

// Slide 6 — close card
const slide6 = Base([
  ...Corners(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%' } },
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 30, color: INK1, letterSpacing:'0.02em' } }, 'AI SPEED.'),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 30, color: GOLD, letterSpacing:'0.02em', marginTop: 4 } }, 'LAWYER ACCOUNTABILITY.'),
    h('div', { style: { display:'flex', width: 90, height: 1, background: GOLD_DIM, margin: '30px 0' } }),
    h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 16, color: MUTED, letterSpacing:'0.1em' } }, '@PANDASLP · PANDASLP.COM.NG'),
  ),
  PageDots(6),
])

async function render(element, outName) {
  const image = new ImageResponse(element, { width: W, height: H, fonts: FONTS })
  const buffer = Buffer.from(await image.arrayBuffer())
  writeFileSync(new URL(`./day2-slide-${outName}.png`, import.meta.url), buffer)
  console.log('Wrote day2-slide-' + outName + '.png')
}

await render(slide1, '1')
await render(slide2, '2')
await render(slide3, '3')
await render(slide4, '4')
await render(slide5, '5')
await render(slide6, '6')
