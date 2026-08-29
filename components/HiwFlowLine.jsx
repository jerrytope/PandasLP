'use client'

import { useEffect, useRef, useState } from 'react'

// Decorative connector for the "How It Works" step grid: the line draws itself in once
// the section scrolls into view, then a small pulse travels along it on a loop — visually
// reinforcing that the steps are one continuous, automated handoff. Desktop-only (matches
// .hiw-grid's multi-column breakpoint); hidden on the single-column mobile layout via CSS.
// `steps` controls how many equal-width column centers the path connects — pass the same
// number as the .hiw-grid's item count so the nodes line up with the cards above them.
export default function HiwFlowLine({ steps = 3 }) {
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

  // Center of each of `steps` equal-width columns spanning 0-100.
  const centers = Array.from({ length: steps }, (_, i) => (100 / steps) * (i + 0.5))
  const pathD = `M ${centers.map((x) => `${x} 5`).join(' L ')}`

  return (
    <svg
      ref={ref}
      className="hiw-flow-line"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={pathD}
        className={`hiw-flow-path ${visible ? 'hiw-flow-path-drawn' : ''}`}
      />
      {visible && <circle r="0.9" className="hiw-flow-pulse">
        <animateMotion
          dur="3.2s"
          repeatCount="indefinite"
          begin="0.9s"
          path={pathD}
        />
      </circle>}
      {centers.map((x) => (
        <circle key={x} cx={x} cy={5} r="1.6" className="hiw-flow-node" />
      ))}
    </svg>
  )
}
