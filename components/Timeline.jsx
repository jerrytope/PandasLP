'use client'

import { useEffect, useRef, useState } from 'react'

/* ─────────────────────────────────────────────────────────────
   The debt recovery clock.

   Same four checkpoints and the same words as before. The only
   change is that they now sit on a drawn track instead of in four
   separate boxes, so the sequence reads as a sequence: the line
   travels left to right through the markers as the fourteen days
   pass, and the last marker fills gold because filing at the
   Small Claims Court is what the whole timeline is aimed at.

   Used on the homepage and on the debt recovery agent page, which
   is why the cells are a prop rather than a constant here.
   ───────────────────────────────────────────────────────────── */

export default function Timeline({ cells }) {
  const ref = useRef(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setLive(true); return }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) { setLive(true); io.disconnect() }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Markers sit at the left edge of each cell's column. Percentages rather than
  // pixels so this survives every container width without measuring anything.
  const step = 100 / cells.length

  return (
    <div ref={ref} className={`lp-rail-wrap${live ? ' is-live' : ''}`}>
      <span className="lp-rail-track" aria-hidden="true" />
      {cells.map((c, i) => (
        <span
          key={c.d}
          aria-hidden="true"
          className={c.on ? 'lp-rail-mark is-on' : 'lp-rail-mark'}
          style={{ left: `${i * step}%`, animationDelay: `${0.15 + i * 0.26}s` }}
        />
      ))}

      <div className="lp-rail">
        {cells.map((c) => (
          <div key={c.d} className={c.on ? 'lp-rail-cell is-on' : 'lp-rail-cell'}>
            <div className="lp-rail-n">{c.d}</div>
            <div className="lp-eyebrow">Day</div>
            <div className="lp-rail-t">{c.t}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
