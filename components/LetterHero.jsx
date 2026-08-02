'use client'

import { CheckCircle2 } from 'lucide-react'
import { PandasLogoMark } from './PandasLogo'

// The hero visual: the actual letter, not a stock photo or another decorative animation.
// A second card peeks out from behind for depth (stacked-documents read), the front card
// carries the real letterhead mark plus abstracted (not fake-readable) body lines, and a
// status tag floats near the corner referencing the real "Served" state from the dashboard.
export default function LetterHero() {
  return (
    <div className="letter-hero" aria-hidden="true">
      <div className="letter-hero-card letter-hero-card-back" />
      <div className="letter-hero-card letter-hero-card-front">
        <div className="letter-hero-seal" />
        <div className="letter-hero-mark">
          <PandasLogoMark size={34} />
          <span>Pandas LP</span>
        </div>
        <div className="letter-hero-lines">
          <span className="letter-hero-line" style={{ width: '86%' }} />
          <span className="letter-hero-line" style={{ width: '92%' }} />
          <span className="letter-hero-line" style={{ width: '64%' }} />
          <span className="letter-hero-line letter-hero-line-gap" style={{ width: '78%' }} />
          <span className="letter-hero-line" style={{ width: '90%' }} />
          <span className="letter-hero-line" style={{ width: '52%' }} />
        </div>
        <div className="letter-hero-sig" />
      </div>
      <div className="letter-hero-status">
        <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
        Served &middot; Day 0 of 14
      </div>
    </div>
  )
}
