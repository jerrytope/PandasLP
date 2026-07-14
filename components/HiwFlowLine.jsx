'use client'

import { useEffect, useRef, useState } from 'react'

// Decorative connector for the "How It Works" 3-step grid: the line draws itself in
// once the section scrolls into view, then a small pulse travels along it on a loop —
// visually reinforcing that the three steps are one continuous, automated handoff.
// Desktop-only (matches .hiw-grid's 3-column breakpoint); hidden on the single-column
// mobile layout via CSS since the path math assumes three equal-width columns.
export default function HiwFlowLine() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <svg
      ref={ref}
      className="hiw-flow-line"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M 16.66 5 L 50 5 L 83.33 5"
        className={`hiw-flow-path ${visible ? 'hiw-flow-path-drawn' : ''}`}
      />
      {visible && <circle r="0.9" className="hiw-flow-pulse">
        <animateMotion
          dur="3.2s"
          repeatCount="indefinite"
          begin="0.9s"
          path="M 16.66 5 L 50 5 L 83.33 5"
        />
      </circle>}
      {[16.66, 50, 83.33].map((x) => (
        <circle key={x} cx={x} cy={5} r="1.6" className="hiw-flow-node" />
      ))}
    </svg>
  )
}
