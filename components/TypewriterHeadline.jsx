'use client'

import { useEffect, useState } from 'react'

// Types out `lines` (array of strings, one per <br />-separated line) character by
// character, then leaves a blinking cursor at the end. `accentFrom` marks the
// [line index, char index] where the gold accent color begins — everything before
// that point renders in the default text color, matching the headline's existing
// two-tone "They owe you." / "We go after it." treatment.
export default function TypewriterHeadline({ lines, accentFromLine = 1, speed = 32, startDelay = 300 }) {
  const full = lines.join('\n')
  const [count, setCount] = useState(0)
  const done = count >= full.length

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(full.length)
      return
    }
    let i = 0
    let interval
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1
        setCount(i)
        if (i >= full.length) clearInterval(interval)
      }, speed)
    }, startDelay)
    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [full, speed, startDelay])

  const typed = full.slice(0, count)
  const typedLines = typed.split('\n')

  return (
    <>
      <span aria-hidden="true">
        {typedLines.map((line, i) => (
          <span key={i} style={{ color: i >= accentFromLine ? 'var(--accent)' : 'var(--text-1)' }}>
            {line}
            {i < typedLines.length - 1 && <br />}
          </span>
        ))}
        <span className={`typewriter-cursor ${done ? 'typewriter-cursor-blink' : ''}`} />
      </span>
      <span className="sr-only">{lines.join(' ')}</span>
    </>
  )
}
