'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// Cycles through an agent's illustrative workflow states so its roster card reads as a working
// product rather than a static description — per the redesign brief: "Make the agents feel
// alive... avoid gimmicky robots or excessive futuristic effects." Purely illustrative, not a
// live process trace of an actual running job. Respects prefers-reduced-motion: renders only
// the first state, no cycling, no animation.
export default function AgentPreview({ states, color }: { states: string[]; color: string }) {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduceMotion || states.length <= 1) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % states.length)
    }, 1900)
    return () => clearInterval(id)
  }, [reduceMotion, states.length])

  const current = states[reduceMotion ? 0 : index]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(5, 7, 12, 0.35)',
        border: '1px solid var(--border-subtle)',
        fontSize: 12.5,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-2)',
        minHeight: 36,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: color,
          animation: reduceMotion ? 'none' : 'agent-preview-pulse 1.4s ease-in-out infinite',
        }}
      />
      {reduceMotion ? (
        <span>{current}</span>
      ) : (
        <AnimatePresence mode="wait">
          <motion.span
            key={current}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {current}
          </motion.span>
        </AnimatePresence>
      )}
    </div>
  )
}
