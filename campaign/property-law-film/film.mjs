// ─────────────────────────────────────────────────────────────────────────────
// Property Law Agent — product film.
//
// Every frame is rendered independently as a pure function of time, so motion is
// authored per-frame rather than faked with a Ken Burns push over a still. That
// is the whole reason this does not reuse story-2026/generate-frames.mjs: that
// set renders one PNG per scene and lets ffmpeg's zoompan do the moving, which
// cannot type, cannot slide a card in, and cannot fill a document field.
//
// Rendered through Satori (next/@vercel/og), the same path the brand already
// uses for x-thread-graphics and opengraph-image.tsx, so the type is real type.
//
// Content rule: every legal fact, price and template line on screen is lifted
// from lib/agents.ts and lib/propertyPricing.ts. Nothing here is invented for
// the camera — if the agent cannot do it, it is not in the film.
//
//   node film.mjs <fromFrame> <toFrame> <layout>   — worker, writes frames/
//   node film.mjs plan                             — prints the scene timing
//
// layout is "v" (1080x1920, the deliverable) or "w" (1920x1080, the cutdown).
// ─────────────────────────────────────────────────────────────────────────────

import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js'
import { createElement as h } from 'react'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'

const here = (p) => new URL(p, import.meta.url)
const FDIR = '../launch-video/story-2026/fonts/'

const FONTS = [
  { name: 'Playfair', data: readFileSync(here(FDIR + 'fs-playfair.woff')), weight: 500, style: 'normal' },
  { name: 'Playfair', data: readFileSync(here(FDIR + 'fs-playfair-italic.woff')), weight: 500, style: 'italic' },
  { name: 'Sans', data: readFileSync(here(FDIR + 'adobe-sans.otf')), weight: 400, style: 'normal' },
  { name: 'Sans', data: readFileSync(here(FDIR + 'adobe-sans-600.otf')), weight: 600, style: 'normal' },
  { name: 'Mono', data: readFileSync(here(FDIR + 'mono-400.ttf')), weight: 400, style: 'normal' },
]

const LOGO = readFileSync(here('../../lib/logoData.js'), 'utf8').match(/'(data:image\/png;base64[^']+)'/)[1]

/* ── palette, lifted from the live site's :root ──────────────────────────── */
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
const GHOST = '#E2DED7'
const BODY = '#4A4A48'

const FPS = 30

/* ── motion ──────────────────────────────────────────────────────────────────
   Easings are deliberately few. One rise-in curve used everywhere reads as a
   house style; a different curve per element reads as a template. */
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x)
const lerp = (a, b, p) => a + (b - a) * p
const outCubic = (p) => 1 - Math.pow(1 - p, 3)
const outQuint = (p) => 1 - Math.pow(1 - p, 5)
const outExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p))
const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

/** progress 0..1 of a window starting at `s` lasting `d`, at time `t`. */
const seg = (t, s, d) => clamp((t - s) / d)

/** the house rise-in: fade up while lifting a few px. */
const rise = (p, dy = 20) => ({
  opacity: clamp(p * 1.25),
  transform: `translateY(${lerp(dy, 0, outCubic(p)).toFixed(2)}px)`,
})

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const mixHex = (a, b, p) => {
  const A = hex(a), B = hex(b)
  const v = A.map((x, i) => Math.round(lerp(x, B[i], clamp(p))))
  return `rgb(${v[0]},${v[1]},${v[2]})`
}
const alpha = (c, a) => {
  const v = hex(c)
  return `rgba(${v[0]},${v[1]},${v[2]},${clamp(a).toFixed(3)})`
}

/** Reveals `lines` a character at a time; returns [visibleLines, caretIndexInLast]. */
const writeOn = (lines, p) => {
  const total = lines.reduce((n, l) => n + l.length, 0)
  let budget = Math.round(clamp(p) * total)
  const out = []
  for (const l of lines) {
    if (budget <= 0) break
    if (budget >= l.length) { out.push(l); budget -= l.length }
    else { out.push(l.slice(0, budget)); budget = 0; break }
  }
  return out
}

const blink = (t) => (Math.floor(t * 2.2) % 2 === 0 ? 1 : 0.15)

/* ── layout presets ──────────────────────────────────────────────────────── */
const LAYOUTS = {
  v: { W: 1080, H: 1920, PAD: 80, TOP: 150, BOT: 170, stmt: 84, wide: false },
  w: { W: 1920, H: 1080, PAD: 140, TOP: 90, BOT: 90, stmt: 82, wide: true },
}

/* ── shared furniture ────────────────────────────────────────────────────── */

const stage = (L, children, bg) =>
  h('div', {
    style: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: bg, padding: `${L.TOP}px ${L.PAD}px ${L.BOT}px`,
    },
  }, ...children.filter(Boolean))

const kicker = (text, p, light = false) =>
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 16, ...rise(p, 10) } },
    h('div', { style: { display: 'flex', width: lerp(0, 44, outExpo(p)).toFixed(1) + 'px', height: 1, background: light ? GOLD_L : GOLD } }),
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 17, letterSpacing: '2.6px', color: light ? 'rgba(250,250,248,0.6)' : MUTED } }, text),
  )

const lockup = (light = false, scale = 1, p = 1) =>
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 20 * scale, ...rise(p, 12) } },
    h('img', { src: LOGO, width: 76 * scale, height: 50 * scale }),
    h('div', { style: { display: 'flex', width: 1, height: 44 * scale, background: light ? 'rgba(250,250,248,0.3)' : '#D8D2C8' } }),
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 30 * scale, letterSpacing: `${2.4 * scale}px`, color: light ? IVORY : INK } }, 'PANDAS'),
      h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 12 * scale, letterSpacing: `${5 * scale}px`, color: light ? 'rgba(250,250,248,0.55)' : FAINT, marginTop: 6 * scale } }, 'LEGAL PRACTITIONERS'),
    ),
  )

/** Big two-line statement. `lines` = [{t, italic, gold, size}] */
const statement = (L, lines, t, t0 = 0, light = false, stagger = 0.22) =>
  h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' } },
    ...lines.map((l, i) => {
      const p = seg(t, t0 + i * stagger, 0.72)
      return h('div', {
        key: i,
        style: {
          display: 'flex', fontFamily: 'Playfair', fontSize: l.size || L.stmt,
          lineHeight: 1.08, letterSpacing: '-2.5px',
          color: l.gold ? (light ? GOLD_L : GOLD) : (light ? IVORY : INK),
          fontStyle: l.italic ? 'italic' : 'normal',
          ...rise(p, 26),
        },
      }, l.t)
    }),
  )

/** The pointer. A soft disc rather than an OS arrow — it reads as intent, and
    it does not put a Windows cursor inside an Apple-grade film. */
const pointer = (x, y, clickP = -1) => {
  const ring = clickP >= 0 && clickP <= 1
  return h('div', {
    style: {
      position: 'absolute', left: `${x - 40}px`, top: `${y - 40}px`,
      width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
  },
    ring ? h('div', {
      style: {
        position: 'absolute', display: 'flex',
        width: `${lerp(26, 78, outExpo(clickP))}px`, height: `${lerp(26, 78, outExpo(clickP))}px`,
        borderRadius: 999, border: `2px solid ${alpha(GOLD, 0.55 * (1 - clickP))}`,
      },
    }) : null,
    h('div', {
      style: {
        display: 'flex', width: 22, height: 22, borderRadius: 999,
        background: alpha(INK, 0.82), border: `2px solid ${alpha(IVORY, 0.9)}`,
        transform: `scale(${ring ? lerp(0.72, 1, outCubic(clickP)) : 1})`,
      },
    }),
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE CONVERSATION — real copy. The option list is the agent's actual starter
   message; the notice-period answer is the rule from its system prompt.
   ═══════════════════════════════════════════════════════════════════════════ */

const OPTIONS = [
  'Recover possession from a tenant',
  'Draft a tenancy or lease agreement',
  'Prepare a Deed of Assignment',
  'Draw up a Power of Attorney',
  'Search a property before I buy it',
]

const chatHeader = (p, label = 'PROPERTY LAW AGENT', t = 0) =>
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 14, ...rise(p, 10) } },
    h('div', {
      style: {
        display: 'flex', width: 10, height: 10, borderRadius: 5, background: GOLD,
        opacity: 0.55 + 0.45 * Math.abs(Math.sin(t * 1.9)),
      },
    }),
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 16, letterSpacing: '3.2px', color: MUTED } }, label),
  )

const bubble = (L, who, text, p, key, caret = false, t = 0) => {
  const mine = who === 'you'
  return h('div', {
    key,
    style: {
      display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start',
      width: '100%', ...rise(p, 16),
    },
  },
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 12, letterSpacing: '2.2px', color: FAINT, marginBottom: 9 } }, mine ? 'YOU' : 'PANDAS LP'),
    h('div', {
      style: {
        display: 'flex', alignItems: 'flex-end', maxWidth: L.wide ? 900 : 790,
        padding: '20px 24px', borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        fontFamily: 'Sans', fontSize: 27, lineHeight: 1.45,
        background: mine ? INK : PAPER, color: mine ? IVORY : INK,
      },
    },
      h('div', { style: { display: 'flex' } }, text),
      caret ? h('div', { style: { display: 'flex', width: 2, height: 26, marginLeft: 3, marginBottom: 3, background: mine ? IVORY : INK, opacity: blink(t) } }) : null,
    ),
  )
}

const typingDots = (t, p) =>
  h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', ...rise(p, 10) } },
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 12, letterSpacing: '2.2px', color: FAINT, marginBottom: 9 } }, 'PANDAS LP'),
    h('div', {
      style: {
        display: 'flex', gap: 8, padding: '24px 26px', borderRadius: '16px 16px 16px 4px', background: PAPER,
      },
    },
      ...[0, 1, 2].map((i) =>
        h('div', {
          key: i,
          style: {
            display: 'flex', width: 9, height: 9, borderRadius: 999, background: FAINT,
            opacity: 0.28 + 0.62 * Math.abs(Math.sin(t * 4.2 - i * 0.6)),
          },
        }),
      ),
    ),
  )

/** The composer. Watching the client's answer being typed is what sells that
    this is a conversation and not a form. */
const composer = (L, text, p, t, sending = 0) =>
  h('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: 16, width: '100%',
      padding: '16px 16px 16px 26px', borderRadius: 999,
      background: WHITE, border: `1px solid ${RULE}`,
      boxShadow: `0 10px 30px ${alpha(INK, 0.05)}`,
      ...rise(p, 12),
      transform: `translateY(${lerp(12, 0, outCubic(p))}px) scale(${lerp(1, 0.985, sending)})`,
    },
  },
    h('div', { style: { display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 } },
      h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 26, color: text ? INK : FAINT } }, text || 'Reply to the agent'),
      text ? h('div', { style: { display: 'flex', width: 2, height: 26, marginLeft: 3, background: INK, opacity: blink(t) } }) : null,
    ),
    h('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '14px 26px', borderRadius: 999,
        background: text ? INK : GHOST,
        fontFamily: 'Mono', fontSize: 14, letterSpacing: '2.4px',
        color: text ? IVORY : FAINT,
      },
    }, 'SEND'),
  )

/* ═══════════════════════════════════════════════════════════════════════════
   SCENES
   ═══════════════════════════════════════════════════════════════════════════ */

/* 1 ── the problem ─────────────────────────────────────────────────────── */
const sOpen = (L, t) =>
  stage(L, [
    lockup(false, 0.9, seg(t, 0.15, 0.7)),
    statement(L, [
      { t: 'Your tenant has' },
      { t: 'stopped paying.', italic: true, gold: true },
    ], t, 0.65),
    kicker('RECOVERY OF PREMISES  ·  LAGOS', seg(t, 2.2, 0.8)),
  ], IVORY)

/* 2 ── the agent opens, and the client picks ──────────────────────────── */
const sAgentIntro = (L, t) => {
  const introP = seg(t, 0.15, 0.6)
  const msg = 'What do you need today?'
  const typeP = seg(t, 0.6, 1.0)
  const typed = msg.slice(0, Math.round(typeP * msg.length))

  // chips cascade, then the pointer travels to the first one and clicks.
  // chipY is measured off the actual rendered stack (header + bubble + gap +
  // options-marginTop + half a chip), not guessed — it has to land ON the
  // first chip, not in the seam between chip one and two.
  const chipStart = 1.9
  const chipY = L.TOP + 24 + 40 + 103 + 22 + 8 + 33
  const travel = seg(t, 2.4, 0.85)
  const hoverT = 3.25, clickT = 3.85
  const px = lerp(L.W * 0.86, L.PAD + 300, inOut(travel))
  const py = lerp(L.H * 0.86, chipY, inOut(travel))
  const hovered = t > hoverT
  const clickP = t >= clickT ? seg(t, clickT, 0.55) : -1
  const chosen = t > clickT + 0.18

  return h('div', { style: { width: '100%', height: '100%', display: 'flex', background: IVORY } },
    stage(L, [
      chatHeader(introP, 'PROPERTY LAW AGENT', t),
      h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 22, marginTop: 40 } },
        bubble(L, 'ai', typed, seg(t, 0.5, 0.4), 'm1', typeP < 1, t),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 } },
          ...OPTIONS.map((o, i) => {
            const p = seg(t, chipStart + i * 0.11, 0.55)
            const on = i === 0 && hovered
            return h('div', {
              key: i,
              style: {
                display: 'flex', alignItems: 'center', alignSelf: 'flex-start',
                padding: '18px 28px', borderRadius: 12,
                border: `1px solid ${on ? INK : RULE}`,
                background: chosen && i === 0 ? INK : WHITE,
                color: chosen && i === 0 ? IVORY : INK,
                fontFamily: 'Sans', fontSize: 25,
                boxShadow: on ? `0 12px 28px ${alpha(INK, 0.09)}` : `0 2px 8px ${alpha(INK, 0.02)}`,
                opacity: clamp(p * 1.25) * (chosen && i !== 0 ? 0.32 : 1),
                transform: `translateY(${lerp(16, 0, outCubic(p))}px) scale(${on ? 1.012 : 1})`,
              },
            }, o)
          }),
        ),
      ),
      kicker('NINE ROUTES  ·  ONE CONVERSATION', seg(t, 1.4, 0.8)),
    ], IVORY),
    travel > 0 && t < clickT + 0.7 ? pointer(px, py, clickP) : null,
  )
}

/* 3 ── the interview ───────────────────────────────────────────────────── */
const sInterview = (L, t) => {
  const q = "Which state is the property in, and what kind of tenancy does he hold?"
  const ans = 'lagos. monthly tenancy, no rent since january'
  const a2 = "A monthly tenancy takes one month's notice under the Lagos State Tenancy Law 2011. I'll prepare the Notice to Quit."

  const qType = seg(t, 1.5, 1.5)
  const ansType = seg(t, 3.4, 1.9)
  const sent = t > 5.6
  const a2Type = seg(t, 6.6, 2.6)

  const rows = []
  rows.push(bubble(L, 'you', 'Recover possession from a tenant', seg(t, 0.0, 0.5), 'u1'))
  if (t > 0.75 && t < 1.5) rows.push(typingDots(t, seg(t, 0.75, 0.35)))
  if (t >= 1.5) rows.push(bubble(L, 'ai', q.slice(0, Math.round(qType * q.length)), 1, 'a1', qType < 1, t))
  if (sent) rows.push(bubble(L, 'you', ans, seg(t, 5.6, 0.45), 'u2'))
  if (t > 5.95 && t < 6.6) rows.push(typingDots(t, seg(t, 5.95, 0.3)))
  if (t >= 6.6) rows.push(bubble(L, 'ai', a2.slice(0, Math.round(a2Type * a2.length)), 1, 'a2', a2Type < 1, t))

  const composerText = sent ? '' : ans.slice(0, Math.round(ansType * ans.length))
  const sending = t > 5.4 && t < 5.6 ? seg(t, 5.4, 0.2) : 0

  return stage(L, [
    chatHeader(1, 'PROPERTY LAW AGENT', t),
    h('div', {
      style: {
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        flexGrow: 1, gap: 22, marginTop: 36, overflow: 'hidden',
      },
    }, ...rows),
    h('div', { style: { display: 'flex', marginTop: 30 } },
      composer(L, composerText, seg(t, 2.6, 0.5), t, sending),
    ),
  ], IVORY)
}

/* 4 ── the rule the answer came from ───────────────────────────────────── */
const PERIODS = [
  ['WEEKLY', "1 week's notice"],
  ['MONTHLY', "1 month's notice"],
  ['QUARTERLY', "3 months' notice"],
  ['YEARLY', "6 months' notice"],
]
const sRule = (L, t) =>
  stage(L, [
    kicker('NOTICE PERIOD BY TENANCY', seg(t, 0.1, 0.6)),
    h('div', {
      style: {
        display: 'flex', fontFamily: 'Playfair', fontSize: 62, letterSpacing: '-1.8px',
        color: INK, marginTop: 30, marginBottom: 46, ...rise(seg(t, 0.3, 0.7), 18),
      },
    }, 'The period is set by law.'),
    h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, borderTop: `1px solid ${INK}` } },
      ...PERIODS.map(([k, v], i) => {
        const p = seg(t, 0.75 + i * 0.13, 0.6)
        const live = i === 1 && t > 1.75
        const glow = live ? seg(t, 1.75, 0.5) : 0
        return h('div', {
          key: i,
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '30px 24px 30px 0', borderBottom: `1px solid ${RULE}`,
            background: live ? alpha(GOLD, 0.05 * glow) : 'transparent',
            ...rise(p, 14),
          },
        },
          h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 20, letterSpacing: '3.4px', color: live ? GOLD : FAINT, paddingLeft: live ? 24 : 0 } }, k),
          h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 42, color: live ? GOLD : INK, opacity: live ? 1 : 0.55 } }, v),
        )
      }),
    ),
    kicker('LAGOS STATE TENANCY LAW 2011', seg(t, 2.2, 0.7)),
  ], IVORY)

/* 5 ── the document takes shape ────────────────────────────────────────── */
const FIELDS = [
  ['TENANT', 'Mr. C. Okafor'],
  ['PROPERTY', '14 Adeola Odeku Street, Victoria Island'],
  ['TENANCY', 'Monthly  ·  Lagos State'],
  ['NOTICE', 'One (1) month'],
]

const DOC_LINES = [
  'We are Solicitors to Mr. A. Sobayo ("our Client"), the landlord',
  'of the premises situate at 14 Adeola Odeku Street, Victoria',
  'Island, Lagos, and write on our Client’s instructions.',
  '',
  'TAKE NOTICE that our Client hereby gives you notice to QUIT',
  'AND DELIVER UP vacant possession of the said premises which',
  'you hold as our Client’s tenant, on or before the expiration of',
  'one (1) month from the date of service of this notice.',
  '',
  'TAKE FURTHER NOTICE that if you fail to deliver up vacant',
  'possession within the period stated above, steps will be taken',
  'to recover possession through the appropriate court.',
]

/** The paper. `wr` 0..1 writes the body on; `fp` 0..1 flows the fields in;
    `sign` 0..1 turns the review footer into a signature. */
const docCard = (L, t, wr, fp, sign, push = 0) => {
  const shown = writeOn(DOC_LINES, wr)
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'column', width: '100%',
      background: WHITE, border: `1px solid ${RULE}`, borderRadius: 6,
      padding: '44px 48px', boxShadow: `0 30px 70px ${alpha(INK, 0.08)}`,
      transform: `scale(${lerp(0.985, 1.015, push)})`,
    },
  },
    // letterhead
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 15, paddingBottom: 16, borderBottom: `2px solid ${INK}` } },
      h('img', { src: LOGO, width: 54, height: 35 }),
      h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 21, letterSpacing: '2px', color: INK } }, 'PANDAS LP'),
    ),
    // the answers, flowing in as structured fields
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 } },
      ...FIELDS.map(([k, v], i) => {
        const p = clamp((fp * FIELDS.length) - i)
        if (p <= 0) return null
        return h('div', {
          key: i,
          style: {
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '11px 16px', borderRadius: 8,
            background: alpha(GOLD, 0.07 * (1 - clamp((p - 0.6) / 0.4)) + 0.028),
            ...rise(p, 12),
          },
        },
          h('div', { style: { display: 'flex', width: 7, height: 7, borderRadius: 999, background: GOLD } }),
          h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 13, letterSpacing: '2.4px', color: FAINT, width: 120 } }, k),
          h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 21, color: INK } }, v),
        )
      }).filter(Boolean),
    ),
    h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 27, lineHeight: 1.3, color: INK, marginTop: 28, opacity: clamp(wr * 6) } },
      'NOTICE TO QUIT AND DELIVER UP VACANT POSSESSION'),
    h('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 20, minHeight: 300 } },
      ...shown.map((l, i) =>
        h('div', {
          key: i,
          style: { display: 'flex', fontFamily: 'Sans', fontSize: 20, lineHeight: 1.62, color: BODY, minHeight: 32 },
        }, l || ' '),
      ),
    ),
    // the gate
    h('div', {
      style: {
        display: 'flex', flexDirection: 'column', marginTop: 26, paddingTop: 20,
        borderTop: `1px solid ${RULE}`,
      },
    },
      sign < 0.5
        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, opacity: clamp(wr * 3 - 1.6) } },
            h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 14, letterSpacing: '2.4px', color: FAINT } }, 'AWAITING PRACTITIONER REVIEW'),
            h('div', { style: { display: 'flex', width: '100%', height: 3, borderRadius: 999, background: GHOST } },
              h('div', { style: { display: 'flex', width: `${(clamp(sign / 0.5) * 100).toFixed(1)}%`, height: 3, borderRadius: 999, background: GOLD } }),
            ),
          )
        : h('div', { style: { display: 'flex', flexDirection: 'column', ...rise(seg(sign, 0.5, 0.35), 10) } },
            h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 34, fontStyle: 'italic', color: FAINT } }, '[ practitioner signature ]'),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 } },
              h('div', { style: { display: 'flex', width: 7, height: 7, borderRadius: 999, background: GOLD } }),
              h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 13, letterSpacing: '2px', color: MUTED } }, 'REVIEWED AND SIGNED  ·  PANDAS LP'),
            ),
          ),
    ),
  )
}

const sDocument = (L, t) =>
  stage(L, [
    kicker('YOUR ANSWERS BECOME THE DOCUMENT', seg(t, 0.1, 0.6)),
    h('div', { style: { display: 'flex', flexGrow: 1, alignItems: 'center', marginTop: 34, ...rise(seg(t, 0.35, 0.8), 26) } },
      docCard(L, t, seg(t, 3.1, 5.6), seg(t, 0.9, 1.9), 0, seg(t, 0.4, 9.0) * 0.5),
    ),
    kicker('₦25,000  ·  TENANCY AND RECOVERY DOCUMENTS', seg(t, 8.4, 0.7)),
  ], IVORY)

/* 6 ── the gate closes ─────────────────────────────────────────────────── */
const sGate = (L, t) =>
  stage(L, [
    kicker('BEFORE IT LEAVES THE OFFICE', seg(t, 0.05, 0.5)),
    h('div', { style: { display: 'flex', flexGrow: 1, alignItems: 'center', marginTop: 34 } },
      docCard(L, t, 1, 1, seg(t, 0.5, 2.6), 0.5 + seg(t, 0, 4.6) * 0.4),
    ),
    kicker('EVERY DOCUMENT  ·  EVERY TIME', seg(t, 3.4, 0.7)),
  ], IVORY)

/* 7 ── the conviction beat ─────────────────────────────────────────────── */
const sSigned = (L, t) =>
  stage(L, [
    lockup(true, 0.85, seg(t, 0.1, 0.6)),
    statement(L, [
      { t: 'A licensed practitioner' },
      { t: 'signs every page.', italic: true, gold: true },
    ], t, 0.4, true),
    kicker('THE AGENT DRAFTS  ·  THE LAWYER ANSWERS FOR IT', seg(t, 1.7, 0.8), true),
  ], DARK)

/* 8 ── the statutory sequence ──────────────────────────────────────────── */
const STEPS = [
  ['01', 'NOTICE TO QUIT', "One month's notice, served on the tenant"],
  ['02', 'THE NOTICE EXPIRES', 'The tenancy ends on the date stated'],
  ['03', "SEVEN DAYS' NOTICE", 'Of the owner’s intention to recover possession'],
  ['04', 'COURT APPLICATION', 'Possession is recovered by order, never by force'],
]
const sSequence = (L, t) =>
  stage(L, [
    kicker('TWO NOTICES, IN ORDER', seg(t, 0.1, 0.6)),
    h('div', {
      style: {
        display: 'flex', fontFamily: 'Playfair', fontSize: 60, letterSpacing: '-1.8px',
        color: INK, marginTop: 28, marginBottom: 44, ...rise(seg(t, 0.25, 0.7), 18),
      },
    }, 'One step cannot skip the other.'),
    h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, gap: 0 } },
      ...STEPS.map(([n, title, sub], i) => {
        const p = seg(t, 0.9 + i * 0.62, 0.7)
        const on = p > 0.35
        return h('div', { key: i, style: { display: 'flex', gap: 26 } },
          // rail
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 34 } },
            h('div', {
              style: {
                display: 'flex', width: 14, height: 14, borderRadius: 999,
                background: on ? GOLD : GHOST, marginTop: 8,
                transform: `scale(${lerp(0.4, 1, outExpo(clamp(p / 0.5)))})`,
              },
            }),
            i < STEPS.length - 1
              ? h('div', {
                  style: {
                    display: 'flex', width: 2, flexGrow: 1, minHeight: 92, marginTop: 8,
                    background: GHOST,
                  },
                },
                  h('div', { style: { display: 'flex', width: 2, height: `${(clamp((p - 0.4) / 0.6) * 100).toFixed(0)}%`, background: GOLD } }),
                )
              : null,
          ),
          h('div', { style: { display: 'flex', flexDirection: 'column', paddingBottom: 34, ...rise(p, 14) } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
              h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 14, letterSpacing: '2.6px', color: on ? GOLD : GHOST } }, n),
              h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 17, letterSpacing: '2.6px', color: on ? INK : GHOST } }, title),
            ),
            h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 24, lineHeight: 1.4, color: MUTED, marginTop: 12, maxWidth: 700 } }, sub),
          ),
        )
      }),
    ),
  ], IVORY)

/* 9 ── pivot to buying ─────────────────────────────────────────────────── */
const sSearchStmt = (L, t) =>
  stage(L, [
    lockup(false, 0.85, seg(t, 0.1, 0.55)),
    statement(L, [
      { t: 'Buying instead?' },
      { t: 'Search it first.', italic: true, gold: true },
    ], t, 0.35),
    kicker('TITLE  ·  DUE DILIGENCE', seg(t, 1.5, 0.7)),
  ], IVORY)

/* 10 ── the two searches ───────────────────────────────────────────────── */
const SEARCHES = [
  {
    name: 'STANDARD SEARCH', price: '₦50,000', gold: false,
    items: ['The registered owner of record', 'Registered encumbrances', 'The basic title position'],
    foot: 'Carried out by the firm at the Land Registry',
  },
  {
    name: 'COMPREHENSIVE SEARCH', price: 'from ₦100,000', gold: true,
    items: ['Physical inspection of the land', 'The survey checked against the land', 'The root of title investigated', 'A full written due-diligence report'],
    foot: 'Scope and fee set by a lawyer, not by the agent',
  },
]

const searchCard = (L, s, p, tickP) =>
  h('div', {
    style: {
      display: 'flex', flexDirection: 'column', flexGrow: 1, flexBasis: 0,
      background: WHITE, borderRadius: 14,
      border: `1px solid ${s.gold ? alpha(GOLD, 0.45) : RULE}`,
      padding: '32px 34px',
      boxShadow: s.gold ? `0 26px 60px ${alpha(GOLD, 0.13)}` : `0 16px 40px ${alpha(INK, 0.05)}`,
      ...rise(p, 26),
    },
  },
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 15, letterSpacing: '3px', color: s.gold ? GOLD : MUTED } }, s.name),
    h('div', { style: { display: 'flex', fontFamily: 'Playfair', fontSize: 52, letterSpacing: '-1.4px', color: INK, marginTop: 14 } }, s.price),
    h('div', { style: { display: 'flex', width: 40, height: 1, background: s.gold ? GOLD : RULE, marginTop: 22, marginBottom: 22 } }),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 15, flexGrow: 1 } },
      ...s.items.map((it, i) => {
        const q = clamp((tickP * (s.items.length + 0.8)) - i)
        return h('div', {
          key: i,
          style: { display: 'flex', alignItems: 'flex-start', gap: 14, opacity: clamp(q * 1.6) },
        },
          h('div', {
            style: {
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: 999, marginTop: 4,
              background: q > 0.55 ? (s.gold ? GOLD : INK) : GHOST,
              transform: `scale(${lerp(0.5, 1, outExpo(clamp(q / 0.6)))})`,
            },
          },
            h('div', { style: { display: 'flex', width: 7, height: 7, borderRadius: 999, background: WHITE } }),
          ),
          h('div', { style: { display: 'flex', fontFamily: 'Sans', fontSize: 22, lineHeight: 1.4, color: INK } }, it),
        )
      }),
    ),
    h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 13, letterSpacing: '1.6px', color: FAINT, marginTop: 26, lineHeight: 1.6 } }, s.foot),
  )

const sSearchOpts = (L, t) =>
  stage(L, [
    kicker('THE AGENT EXPLAINS BOTH', seg(t, 0.05, 0.5)),
    h('div', {
      style: {
        display: 'flex', fontFamily: 'Playfair', fontSize: 58, letterSpacing: '-1.8px',
        color: INK, marginTop: 26, marginBottom: 36, ...rise(seg(t, 0.2, 0.7), 16),
      },
    }, 'Two ways to check a title.'),
    h('div', {
      style: {
        display: 'flex', flexDirection: L.wide ? 'row' : 'column',
        gap: L.wide ? 40 : 26, flexGrow: 1,
      },
    },
      searchCard(L, SEARCHES[0], seg(t, 0.7, 0.8), seg(t, 1.4, 1.5)),
      searchCard(L, SEARCHES[1], seg(t, 1.15, 0.8), seg(t, 3.3, 2.3)),
    ),
  ], IVORY)

/* 11 ── the honest line ────────────────────────────────────────────────── */
const sSearchTruth = (L, t) =>
  stage(L, [
    kicker('WHAT THE AGENT WILL NOT DO', seg(t, 0.1, 0.6)),
    statement(L, [
      { t: 'The agent takes', size: L.stmt - 4 },
      { t: 'the instruction.', size: L.stmt - 4 },
      { t: 'The firm does', size: L.stmt - 4, gold: true, italic: true },
      { t: 'the searching.', size: L.stmt - 4, gold: true, italic: true },
    ], t, 0.35, false, 0.16),
    kicker('NOTHING ASSUMED  ·  NOTHING INVENTED', seg(t, 2.0, 0.8)),
  ], IVORY)

/* 12 ── close ──────────────────────────────────────────────────────────── */
const sClose = (L, t) =>
  stage(L, [
    lockup(true, 1.05, seg(t, 0.2, 0.8)),
    h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' } },
      h('div', {
        style: {
          display: 'flex', fontFamily: 'Playfair', fontSize: L.stmt + 4, lineHeight: 1.08,
          letterSpacing: '-2.5px', color: IVORY, ...rise(seg(t, 0.75, 0.8), 24),
        },
      }, 'Property Law'),
      h('div', {
        style: {
          display: 'flex', fontFamily: 'Playfair', fontStyle: 'italic', fontSize: L.stmt + 4,
          lineHeight: 1.08, letterSpacing: '-2.5px', color: GOLD_L, ...rise(seg(t, 0.95, 0.8), 24),
        },
      }, 'Agent'),
      h('div', {
        style: {
          display: 'flex', fontFamily: 'Sans', fontSize: 27, lineHeight: 1.5, color: 'rgba(250,250,248,0.62)',
          marginTop: 30, maxWidth: 760, ...rise(seg(t, 1.5, 0.8), 16),
        },
      }, 'Notices, tenancies, deeds and searches — taken from a conversation to a signed instrument.'),
    ),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 16, ...rise(seg(t, 2.3, 0.8), 12) } },
      h('div', { style: { display: 'flex', width: 44, height: 1, background: GOLD_L } }),
      h('div', { style: { display: 'flex', fontFamily: 'Mono', fontSize: 19, letterSpacing: '3.4px', color: IVORY } }, 'PANDASLP.COM.NG'),
    ),
  ], DARK)

/* ═══════════════════════════════════════════════════════════════════════════
   TIMELINE

   Held in one place so the rhythm is legible as a list. Short scenes carry a
   single idea; the document and the searches are allowed to breathe, because
   they are the two moments a viewer actually has to read something.
   ═══════════════════════════════════════════════════════════════════════════ */
const SCENES = [
  { id: 'open',        dur: 4.2,  bg: IVORY, fin: 0.0,  fout: 0.45, r: sOpen },
  { id: 'agent',       dur: 5.3,  bg: IVORY, fin: 0.30, fout: 0.30, r: sAgentIntro },
  { id: 'interview',   dur: 9.9,  bg: IVORY, fin: 0.25, fout: 0.40, r: sInterview },
  { id: 'rule',        dur: 3.9,  bg: IVORY, fin: 0.30, fout: 0.40, r: sRule },
  { id: 'document',    dur: 9.6,  bg: IVORY, fin: 0.35, fout: 0.40, r: sDocument },
  { id: 'gate',        dur: 4.6,  bg: IVORY, fin: 0.30, fout: 0.50, r: sGate },
  { id: 'signed',      dur: 3.4,  bg: DARK,  fin: 0.35, fout: 0.55, r: sSigned },
  { id: 'sequence',    dur: 5.6,  bg: IVORY, fin: 0.35, fout: 0.45, r: sSequence },
  { id: 'searchStmt',  dur: 2.9,  bg: IVORY, fin: 0.30, fout: 0.40, r: sSearchStmt },
  { id: 'searchOpts',  dur: 8.6,  bg: IVORY, fin: 0.30, fout: 0.45, r: sSearchOpts },
  { id: 'searchTruth', dur: 3.6,  bg: IVORY, fin: 0.30, fout: 0.55, r: sSearchTruth },
  { id: 'close',       dur: 5.4,  bg: DARK,  fin: 0.45, fout: 0.90, r: sClose },
]

let acc = 0
for (const s of SCENES) { s.t0 = acc; acc += s.dur; s.t1 = acc }
export const DURATION = acc
export const TOTAL_FRAMES = Math.round(DURATION * FPS)

const sceneAt = (t) => {
  for (const s of SCENES) if (t < s.t1) return s
  return SCENES[SCENES.length - 1]
}

/** Background is continuous across the whole film so an ivory→dark change is a
    grade, not a cut. */
const bgAt = (t) => {
  const i = SCENES.findIndex((s) => t < s.t1)
  const s = SCENES[i < 0 ? SCENES.length - 1 : i]
  const next = SCENES[i + 1]
  if (next && t > s.t1 - s.fout) return mixHex(s.bg, next.bg, (t - (s.t1 - s.fout)) / s.fout)
  return s.bg
}

/** The whole film, at time t. */
const frameAt = (L, t) => {
  const s = sceneAt(t)
  const local = t - s.t0
  const inP = s.fin > 0 ? clamp(local / s.fin) : 1
  const outP = s.fout > 0 ? clamp((s.t1 - t) / s.fout) : 1
  const a = Math.min(inP, outP)
  // A whisper of drift on the way out keeps cuts from feeling like slides.
  const drift = lerp(10, 0, outCubic(inP)) - lerp(0, 6, 1 - outP)

  return h('div', {
    style: {
      width: '100%', height: '100%', display: 'flex', background: bgAt(t),
    },
  },
    h('div', {
      style: {
        width: '100%', height: '100%', display: 'flex',
        opacity: clamp(a * 1.05), transform: `translateY(${drift.toFixed(2)}px)`,
      },
    }, s.r(L, local)),
  )
}

/* ── driver ──────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2)

if (argv[0] === 'plan') {
  console.log(`${SCENES.length} scenes  ·  ${DURATION.toFixed(1)}s  ·  ${TOTAL_FRAMES} frames @ ${FPS}fps\n`)
  for (const s of SCENES) console.log(`  ${s.t0.toFixed(1).padStart(5)}s  ${s.id.padEnd(12)} ${s.dur.toFixed(1)}s`)
  process.exit(0)
}

const from = parseInt(argv[0] ?? '0', 10)
const to = parseInt(argv[1] ?? String(TOTAL_FRAMES), 10)
const L = LAYOUTS[argv[2] ?? 'v']
const outDir = argv[3] ?? `frames-${argv[2] ?? 'v'}`
mkdirSync(here(outDir), { recursive: true })

for (let f = from; f < to && f < TOTAL_FRAMES; f++) {
  const t = f / FPS
  const img = new ImageResponse(frameAt(L, t), { width: L.W, height: L.H, fonts: FONTS })
  writeFileSync(new URL(`${outDir}/${String(f).padStart(5, '0')}.png`, import.meta.url), Buffer.from(await img.arrayBuffer()))
  if ((f - from) % 60 === 0) process.stdout.write(`  ${outDir} ${f}/${to}\n`)
}
