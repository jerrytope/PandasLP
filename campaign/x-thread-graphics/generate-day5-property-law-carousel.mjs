// Day 5 of the 7-day Instagram launch plan — Property Law Agent spotlight, 5-slide dossier
// carousel. Deliberately matches Day 4's navy/gold palette (small-claims-thread-journey.png)
// rather than the ivory system, since these two "Agent Spotlight" days are meant to read as a
// matched pair. Content pulled from lib/agentCapabilities.ts (recovery-of-premises) and the
// actual notice-template voice fixed earlier this session in lib/agents.ts — no invented copy.
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { readFileSync, writeFileSync } from 'fs'

const logoSrc = readFileSync(new URL('../../lib/logoDataLight.ts', import.meta.url), 'utf8')
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
const BG = '#182A3A'
const CARD_BG = '#1F3446'
const CARD_BORDER = 'rgba(214,187,128,0.25)'
const GOLD = '#D6BB80'
const GOLD_DIM = 'rgba(214,187,128,0.4)'
const TEXT_1 = '#F3EFE3'
const MUTED = '#ABB1A2'
const PAPER = '#EDE6D3'
const INK = '#1F1A12'

function Base(children) {
  return h('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: BG, position: 'relative', overflow: 'hidden' } }, children)
}
function Glow() {
  return h('div', { style: { position: 'absolute', top: -180, right: -140, width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(214,187,128,0.28) 0%, rgba(214,187,128,0) 70%)', display: 'flex' } })
}
function Header() {
  return h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '52px 56px 0' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      h('img', { src: LOGO_DATA_URI, width: 54, height: 36, alt: '' }),
      h('span', { style: { display: 'flex', fontSize: 18, fontWeight: 700, color: TEXT_1, letterSpacing: '-0.01em' } }, 'Pandas ', h('span', { style: { display: 'flex', color: GOLD } }, 'LP')),
    ),
    h('span', { style: { display: 'flex', fontFamily: 'DM Mono', fontSize: 13, color: MUTED, letterSpacing: '0.12em' } }, 'PROPERTY LAW'),
  )
}
function PageDots(active) {
  return h('div', { style: { position: 'absolute', bottom: 44, display: 'flex', width: '100%', justifyContent: 'center', gap: 8 } },
    [1,2,3,4,5].map((n) => h('div', { key: n, style: { display:'flex', width: n===active?22:7, height: 7, borderRadius: 4, background: n===active?GOLD:GOLD_DIM } })))
}

// Slide 1 — agent card
const slide1 = Base([
  Glow(), Header(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', padding:'0 90px' } },
    h('div', { style: { display:'flex', alignItems:'center', gap: 8, padding:'8px 18px', borderRadius: 20, border: `1px solid ${GOLD_DIM}`, marginBottom: 30 } },
      h('span', { style: { display:'flex', width: 7, height: 7, borderRadius: 4, background: '#3ECF8E' } }),
      h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 13, color: TEXT_1, letterSpacing:'0.14em' } }, 'AGENT · LIVE NOW'),
    ),
    h('span', { style: { display:'flex', fontSize: 84, marginBottom: 16 } }, '🏠'),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 50, color: TEXT_1, letterSpacing:'0.01em', textAlign:'center' } }, 'Property Law Agent'),
    h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 18, color: MUTED, textAlign:'center', maxWidth: 540, lineHeight: 1.6, marginTop: 18 } }, 'Notices to Quit, tenancy agreements, deeds, and title searches — under Nigerian property law.'),
  ),
  PageDots(1),
])

// Slide 2 — what it handles (real, from lib/agentCapabilities.ts)
function Item(text) {
  return h('div', { style: { display:'flex', alignItems:'flex-start', gap: 14, width: '100%' } },
    h('span', { style: { display:'flex', color: GOLD, fontSize: 20, marginTop: -2 } }, '✓'),
    h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 20, color: TEXT_1, lineHeight: 1.5 } }, text),
  )
}
const slide2 = Base([
  Glow(), Header(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', justifyContent:'center', width:'100%', height:'100%', padding:'0 76px', gap: 30 } },
    h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 14, color: GOLD, letterSpacing:'0.3em', marginBottom: 6 } }, 'WHAT IT HANDLES'),
    Item('Notices to Quit and Seven-Day Notices, with the correct statutory notice period'),
    Item('Tenancy and lease agreements'),
    Item('Deeds of Assignment, Gift, and Legal Mortgage, with Governor’s Consent handling'),
    Item('Powers of Attorney, Agreements for Sale of Land, and title search reports'),
  ),
  PageDots(2),
])

// Slide 3 — pricing, real figure
const slide3 = Base([
  Glow(), Header(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', padding:'0 90px' } },
    h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 14, color: GOLD, letterSpacing:'0.3em', marginBottom: 26 } }, 'PRICING'),
    h('div', { style: { display:'flex', flexDirection:'column', alignItems:'center', gap: 10, padding: '40px 60px', borderRadius: 20, background: CARD_BG, border: `1px solid ${CARD_BORDER}` } },
      h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 64, color: GOLD } }, 'N5,000'),
      h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 19, color: MUTED } }, 'Flat — across every document type'),
    ),
    h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 17, color: MUTED, textAlign:'center', maxWidth: 480, lineHeight: 1.6, marginTop: 30 } }, 'No hourly billing. No surprise invoices. See the price before you start.'),
  ),
  PageDots(3),
])

// Slide 4 — signature slide: the actual notice voice, on a paper card
const slide4 = Base([
  Glow(), Header(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', padding:'0 76px' } },
    h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 14, color: GOLD, letterSpacing:'0.3em', marginBottom: 24 } }, 'HOW A NOTICE ACTUALLY READS'),
    h('div', { style: { display:'flex', flexDirection:'column', width: '100%', maxWidth: 620, background: PAPER, color: INK, borderRadius: 4, padding: '38px 40px', gap: 14, boxShadow: '0 30px 70px rgba(0,0,0,0.45)' } },
      h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 17, letterSpacing:'0.03em' } }, 'NOTICE TO QUIT'),
      h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 17, lineHeight: 1.6 } }, 'We are Solicitors to [Landlord] (“our Client”), the landlord/agent of the premises situate at [Property Address], and write on our Client’s instructions.'),
      h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 17, lineHeight: 1.6, marginTop: 4 } }, 'TAKE NOTICE that our Client hereby gives you notice to QUIT AND DELIVER UP vacant possession…'),
    ),
    h('span', { style: { display:'flex', fontFamily:'Inter', fontSize: 16, color: MUTED, textAlign:'center', maxWidth: 520, lineHeight: 1.6, marginTop: 26 } }, 'Written as your solicitors, not as an angry landlord text — the way it should read if it ever needs to hold up.'),
  ),
  PageDots(4),
])

// Slide 5 — CTA
const slide5 = Base([
  Glow(), Header(),
  h('div', { key:'body', style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', width:'100%', height:'100%' } },
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 40, color: TEXT_1, textAlign:'center', maxWidth: 560, lineHeight: 1.35 } }, 'Landlord or tenant issue?'),
    h('span', { style: { display:'flex', fontFamily:'Cinzel', fontSize: 40, color: GOLD, textAlign:'center', marginBottom: 30 } }, 'Start here.'),
    h('div', { style: { display:'flex', width: 90, height: 1, background: GOLD_DIM, marginBottom: 26 } }),
    h('span', { style: { display:'flex', fontFamily:'DM Mono', fontSize: 16, color: MUTED, letterSpacing:'0.1em' } }, '@PANDASLP · PANDASLP.COM.NG'),
  ),
  PageDots(5),
])

async function render(element, outName) {
  const image = new ImageResponse(element, { width: W, height: H, fonts: FONTS })
  const buffer = Buffer.from(await image.arrayBuffer())
  writeFileSync(new URL(`./day5-slide-${outName}.png`, import.meta.url), buffer)
  console.log('Wrote day5-slide-' + outName + '.png')
}

await render(slide1, '1')
await render(slide2, '2')
await render(slide3, '3')
await render(slide4, '4')
await render(slide5, '5')
