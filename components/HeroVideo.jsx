'use client'

import { useEffect, useRef } from 'react'

/* ─────────────────────────────────────────────────────────────
   Homepage hero film: a client opening a letter in her studio.

   Full-bleed background behind the hero copy. Muted, looping, no
   controls, and decorative (the h1 carries the meaning). The poster
   is the first frame, so the hero never sits empty while the video
   loads, and it is all that visitors who ask for reduced motion see.
   ───────────────────────────────────────────────────────────── */

export default function HeroVideo() {
  const ref = useRef(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      if (mq.matches) {
        v.pause()
        v.currentTime = 0
      } else {
        v.play().catch(() => {})
      }
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <div className="lp-hero-bg" aria-hidden="true">
      <video ref={ref} muted loop playsInline preload="metadata" poster="/img/hero-wide-poster.jpg" tabIndex={-1}>
        <source src="/video/hero-wide.webm" type="video/webm" />
        <source src="/video/hero-wide.mp4" type="video/mp4" />
      </video>
    </div>
  )
}
