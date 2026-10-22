'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './ui.module.css'

export interface RunLogStep {
  /** done = ✓, next = → (waiting on someone, usually the lawyer) */
  status: 'done' | 'next'
  text: string
  /** Right-aligned detail, e.g. a figure or a time. */
  detail?: string
}

// A matter's steps in a quiet window frame: the product shown working, with real step names
// from the agents' flows. When animate is on, the steps appear one by one the first time it
// scrolls into view; with reduced motion they are all there from the start.
export default function RunLog({ title, steps, animate = true }: { title: string; steps: RunLogStep[]; animate?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(animate ? 0 : steps.length)

  useEffect(() => {
    if (!animate) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(steps.length)
      return
    }
    const el = ref.current
    if (!el) return
    let timer: ReturnType<typeof setInterval> | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        timer = setInterval(() => {
          setShown((n) => {
            if (n + 1 >= steps.length && timer) clearInterval(timer)
            return Math.min(n + 1, steps.length)
          })
        }, 520)
      },
      { threshold: 0.35 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timer) clearInterval(timer)
    }
  }, [animate, steps.length])

  return (
    <div ref={ref} className={styles.runlog}>
      <div className={styles.runlogBar}>
        <span className={styles.runlogDots} aria-hidden="true"><i /><i /><i /></span>
        <span className={styles.runlogTitle}>{title}</span>
      </div>
      <ol className={styles.runlogBody} aria-label={title}>
        {steps.map((s, i) => (
          <li key={i} className={`${styles.runlogStep} ${s.status === 'next' ? styles.runlogNext : ''}`} data-hidden={i >= shown ? 'true' : 'false'}>
            <span className={styles.runlogIcon} aria-hidden="true">{s.status === 'done' ? '✓' : '→'}</span>
            <span>
              <span className="sr-only">{s.status === 'done' ? 'Done: ' : 'Next: '}</span>
              {s.text}
            </span>
            {s.detail ? <span className={styles.runlogDetail}>{s.detail}</span> : <span />}
          </li>
        ))}
      </ol>
    </div>
  )
}
