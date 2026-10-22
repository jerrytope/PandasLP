'use client'

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import styles from './ui.module.css'

// A horizontal row of cards with a "01 / 06" counter and previous/next buttons. Scrolls with
// touch, trackpad, the buttons, or the arrow keys when focused. heading sits on the left.
export default function Carousel({ label, heading, children }: { label: string; heading?: ReactNode; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const count = Children.count(children)
  const [index, setIndex] = useState(0)

  const sync = useCallback(() => {
    const el = track.current
    if (!el) return
    const items = Array.from(el.children) as HTMLElement[]
    const left = el.scrollLeft
    let nearest = 0
    items.forEach((item, i) => {
      if (Math.abs(item.offsetLeft - el.offsetLeft - left) < Math.abs(items[nearest].offsetLeft - el.offsetLeft - left)) nearest = i
    })
    // At the very end, the last card counts as current even if it can't scroll to the start.
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) nearest = items.length - 1
    setIndex(nearest)
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    el.addEventListener('scroll', sync, { passive: true })
    return () => el.removeEventListener('scroll', sync)
  }, [sync])

  function go(to: number) {
    const el = track.current
    if (!el) return
    const target = el.children[Math.max(0, Math.min(count - 1, to))] as HTMLElement | undefined
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: reduce ? 'auto' : 'smooth' })
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      <div className={styles.carouselHead}>
        <div>{heading}</div>
        <div className={styles.carouselControls}>
          <span className={styles.carouselCounter} aria-live="polite">{pad(index + 1)} / {pad(count)}</span>
          <button type="button" className={styles.carouselButton} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous">
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" className={styles.carouselButton} onClick={() => go(index + 1)} disabled={index >= count - 1} aria-label="Next">
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={track}
        className={styles.carouselTrack}
        role="region"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
        }}
      >
        {children}
      </div>
    </div>
  )
}
