'use client'

import { useEffect, useRef, useState } from 'react'

// A typing-dots indicator that appears once scrolled into view, then hides itself
// shortly before the real message it's standing in for reveals — used as an opening
// beat on the AI Intelligence demo conversation so the first message feels "composed"
// rather than just appearing.
export default function TypingBeat({ showFor = 380 }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let timeoutId = null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        setVisible(true)
        timeoutId = setTimeout(() => setVisible(false), showFor)
      },
      { threshold: 0.15 },
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [showFor])

  if (!visible) return <div ref={ref} aria-hidden="true" />

  return (
    <div className="ai-demo-msg" ref={ref}>
      <span className="ai-demo-msg-sender">Pandas AI</span>
      <div className="typing-dots" style={{ padding: '10px 12px' }}>
        <span /><span /><span />
      </div>
    </div>
  )
}
