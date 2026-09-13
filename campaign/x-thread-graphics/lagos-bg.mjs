// Shared helper for the Sep 2026 palette refresh: swaps the graphics series from the old
// navy/gold night look to the current ivory/gold brand, and gives each card a real, faint
// Lagos photograph as backdrop texture instead of a flat color — real photography (Wikimedia
// Commons, credited below), not an AI-generated skyline, per the "no AI slop" house rule.
import { createElement as h } from 'react'
import { readFileSync } from 'fs'

export const IVORY = '#FAFAF8'
export const INK = '#1A1A1A'
export const MUTED = '#6B6B6B'
export const GOLD = '#B8860B'
export const GOLD_DIM = 'rgba(184,134,11,0.35)'
export const BORDER = '#E8E4DF'
export const BORDER_STRONG = '#D8D2C8'

// CC BY-SA — Wikimedia Commons. Credit lines belong wherever a card using these ships publicly:
// skyline: Clara Sanchiz, CC BY-SA 2.0 · market: Yellowcrunchy, CC BY-SA 4.0
const SKYLINE = toDataUri('./bg-lagos-skyline.jpg')
const MARKET = toDataUri('./bg-lagos-market.jpg')
export const PHOTO = { skyline: SKYLINE, market: MARKET }

function toDataUri(relPath) {
  const buf = readFileSync(new URL(relPath, import.meta.url))
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

// Full-bleed photo, genuinely visible (not a faint tint — Satori doesn't reliably render
// multi-stop radial-gradient overlays, tested and confirmed no-op, so vignetting is out).
// The type sits on a solid ivory card floated over it instead — see `cardStyle` below —
// which keeps every line fully legible while Lagos is unmistakably in frame around it.
const FADE = 'rgba(250,250,248,1)'
const CLEAR = 'rgba(250,250,248,0)'

export function PhotoBackdrop({ photo }) {
  // `inset: 0` silently no-ops in Satori — use explicit top/left instead (confirmed: the
  // shorthand renders nothing, discovered the hard way rendering this exact component).
  // Vignette: Satori's radial-gradient support is unreliable with alpha stops (tested,
  // renders solid instead of a fade) — two stacked linear-gradients, one per axis, produce
  // the same soft-edged fade-to-ivory reliably, so the photo dissolves into the page instead
  // of sitting behind a hard-edged rectangle.
  return h(
    'div',
    { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex' } },
    h('img', { src: photo, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' } }),
    h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', background: `linear-gradient(to bottom, ${FADE} 0%, ${CLEAR} 22%, ${CLEAR} 78%, ${FADE} 100%)` } }),
    h('div', { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', background: `linear-gradient(to right, ${FADE} 0%, ${CLEAR} 22%, ${CLEAR} 78%, ${FADE} 100%)` } }),
  )
}

// Drop onto the div that wraps a card's actual text/logo content (not the full-canvas
// centering wrapper) to float it as a card over the photo — solid fill, thin gold rule,
// soft shadow lifting it off the image.
export function cardStyle(extra = {}) {
  return {
    background: IVORY,
    border: `1px solid ${BORDER_STRONG}`,
    borderRadius: 18,
    boxShadow: '0 30px 70px -20px rgba(26,26,26,0.35)',
    ...extra,
  }
}
