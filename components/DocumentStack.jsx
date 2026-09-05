'use client'

import { useState } from 'react'

/* ─────────────────────────────────────────────────────────────
   The nine property instruments, as a workspace rather than a list.

   Nine equal cards in a grid told you the firm drafts nine things and
   nothing else. The distinction that actually matters to someone with
   a property problem is which of the nine their situation calls for,
   and that is a choice, so this is built as one: pick an instrument on
   the left, read it on the right.

   Every one of the nine names stays on screen at all times. Nothing is
   hidden behind the interaction, which is the difference between an
   interactive section and a section that buried its content. The panel
   only ever adds the description that was already there.

   Real tablist semantics, so this is keyboard operable with arrow keys
   and announces correctly, rather than being a div that listens for
   clicks.
   ───────────────────────────────────────────────────────────── */

export default function DocumentStack({ docs }) {
  const [active, setActive] = useState(0)
  const doc = docs[active]

  // Arrow keys move between instruments, which is what a tablist is expected
  // to do and what a keyboard user will try first.
  function onKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
    const next = (active + dir + docs.length) % docs.length
    setActive(next)
    const el = document.getElementById(`ds-tab-${next}`)
    if (el) el.focus()
  }

  return (
    <div className="ds">
      <div className="ds-list" role="tablist" aria-label="Property instruments" onKeyDown={onKeyDown}>
        {docs.map((d, i) => (
          <button
            key={d.t}
            id={`ds-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls="ds-panel"
            tabIndex={i === active ? 0 : -1}
            className={`ds-item${i === active ? ' is-on' : ''}`}
            onClick={() => setActive(i)}
          >
            <span className="ds-item-k">{d.k}</span>
            <span className="ds-item-t">{d.t}</span>
          </button>
        ))}
      </div>

      {/* Keyed on the active index so the sheet replays its entry each time the
          selection changes. That transition is the only motion here, and it is
          doing state-change feedback, not decoration. */}
      <div className="ds-sheet" id="ds-panel" role="tabpanel" aria-live="polite" key={active}>
        <div className="ds-sheet-head">
          <span className="ds-sheet-k">{doc.k}</span>
          <h3 className="ds-sheet-t">{doc.t}</h3>
        </div>
        <p className="ds-sheet-b">{doc.b}</p>
        <div className="ds-sheet-rules" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div className="ds-sheet-foot">
          <span className="ds-sheet-sig" />
          <span className="ds-sheet-note">Signed by a licensed practitioner before it is served or filed</span>
        </div>
      </div>
    </div>
  )
}
