import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync } from 'fs'
const here = (p) => new URL(p, import.meta.url)
const F = '../launch-video/story-2026/fonts/'
const FONTS = [
  { name: 'Playfair', data: readFileSync(here(F+'fs-playfair.woff')), weight: 500, style: 'normal' },
  { name: 'Playfair', data: readFileSync(here(F+'fs-playfair-italic.woff')), weight: 500, style: 'italic' },
  { name: 'Sans', data: readFileSync(here(F+'adobe-sans.otf')), weight: 400, style: 'normal' },
  { name: 'Sans', data: readFileSync(here(F+'adobe-sans-600.otf')), weight: 600, style: 'normal' },
  { name: 'Mono', data: readFileSync(here(F+'mono-400.ttf')), weight: 400, style: 'normal' },
]
const LOGO = readFileSync(here('../../lib/logoData.js'),'utf8').match(/'(data:image\/png;base64[^']+)'/)[1]
const W=1080,H=1920
const el = h('div',{style:{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#FAFAF8',padding:'110px 80px'}},
  h('img',{src:LOGO,width:76,height:50}),
  h('div',{style:{display:'flex',flexDirection:'column',flexGrow:1,justifyContent:'center'}},
    h('div',{style:{display:'flex',fontFamily:'Playfair',fontSize:86,lineHeight:1.08,letterSpacing:'-2.5px',color:'#1A1A1A',transform:'translateY(-12px)',opacity:0.92}},'Your tenant has'),
    h('div',{style:{display:'flex',fontFamily:'Playfair',fontStyle:'italic',fontSize:86,lineHeight:1.08,letterSpacing:'-2.5px',color:'#B8860B'}},'stopped paying.'),
  ),
  h('div',{style:{display:'flex',alignItems:'center',gap:16}},
    h('div',{style:{display:'flex',width:44,height:1,background:'#B8860B'}}),
    h('div',{style:{display:'flex',fontFamily:'Mono',fontSize:17,letterSpacing:'2px',color:'#6B6B6B'}},'PROPERTY LAW  ·  LAGOS'),
  ),
  h('div',{style:{display:'flex',width:300,height:120,background:'#FFFFFF',border:'1px solid #E8E4DF',borderRadius:14,boxShadow:'0 18px 40px rgba(0,0,0,0.07)',transform:'scale(0.96) translateY(8px)'}}),
)
const t0=Date.now()
const N=6
for(let i=0;i<N;i++){
  const r = new ImageResponse(el,{width:W,height:H,fonts:FONTS})
  const buf = Buffer.from(await r.arrayBuffer())
  if(i===0) writeFileSync('probe.png',buf)
}
console.log('avg ms/frame:', ((Date.now()-t0)/N).toFixed(0))
