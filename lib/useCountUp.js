'use client'

import { useEffect, useRef, useState } from 'react'

// Animates 0 -> target once the returned ref scrolls into view. Respects
// prefers-reduced-motion (jumps straight to target instead of animating).
export function useCountUp(target, { duration = 1600, startDelay = 700 } = {}) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let timeoutId = null
    let rafId = null
    let cancelled = false

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setValue(target)
          return
        }

        timeoutId = setTimeout(() => {
          const start = performance.now()
          function tick(now) {
            if (cancelled) return
            const progress = Math.min((now - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setValue(Math.round(target * eased))
            if (progress < 1) rafId = requestAnimationFrame(tick)
          }
          rafId = requestAnimationFrame(tick)
        }, startDelay)
      },
      { threshold: 0.3 },
    )
    observer.observe(el)

    return () => {
      cancelled = true
      observer.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [target, duration, startDelay])

  return [value, ref]
}
