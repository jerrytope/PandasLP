'use client'

import { Scale, FileText, Shield, Gavel, MessageSquare, Clock } from 'lucide-react'
import { useCountUp } from '../lib/useCountUp'

const BADGES = [
  { icon: Scale, ring: 1, angle: 40, color: '#D4AF37' },
  { icon: Gavel, ring: 1, angle: 220, color: '#93A6C9' },
  { icon: FileText, ring: 2, angle: 120, color: '#818CF8' },
  { icon: MessageSquare, ring: 2, angle: 305, color: '#38BDF8' },
  { icon: Shield, ring: 3, angle: 15, color: '#D4AF37' },
  { icon: Clock, ring: 3, angle: 195, color: '#93A6C9' },
]

export default function OrbitVisual() {
  const [minutes, minutesRef] = useCountUp(10, { duration: 1200 })

  return (
    <div className="orbit-visual" ref={minutesRef} aria-hidden="true">
      <div className="orbit-ring orbit-ring-1 orbit-spin-ccw-slow">
        {BADGES.filter((b) => b.ring === 1).map((b, i) => (
          <OrbitBadge key={i} badge={b} spinClass="orbit-spin-cw-slow" />
        ))}
      </div>
      <div className="orbit-ring orbit-ring-2 orbit-spin-cw-med">
        {BADGES.filter((b) => b.ring === 2).map((b, i) => (
          <OrbitBadge key={i} badge={b} spinClass="orbit-spin-ccw-med" />
        ))}
      </div>
      <div className="orbit-ring orbit-ring-3 orbit-spin-ccw-fast">
        {BADGES.filter((b) => b.ring === 3).map((b, i) => (
          <OrbitBadge key={i} badge={b} spinClass="orbit-spin-cw-fast" />
        ))}
      </div>

      <div className="orbit-center">
        <div className="orbit-center-value">{minutes} min</div>
        <div className="orbit-center-label">Average interview time</div>
      </div>
    </div>
  )
}

function OrbitBadge({ badge, spinClass }) {
  const { icon: Icon, angle, color } = badge
  return (
    <div className="orbit-badge-wrap" style={{ '--orbit-angle': `${angle}deg` }}>
      <div className={`orbit-badge ${spinClass}`} style={{ '--badge-glow': color }}>
        <Icon size={16} strokeWidth={1.75} color={color} />
      </div>
    </div>
  )
}
