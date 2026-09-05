'use client'

import { useEffect, useState } from 'react'
import { formatNaira as naira } from '@/lib/formatNaira'

/* ─────────────────────────────────────────────────────────────
   Money actually recovered for clients.

   Every naira here is a confirmed recovery: a member of the firm
   recorded the amount, evidenced it, and said whether it was the
   whole claim or only part of it. See app/api/recovered/route.ts.

   The component renders nothing at all until that total is above
   zero. No placeholder, no "₦0 recovered", no rounded-up figure
   while we wait for the real one. A number on a law firm's homepage
   is a representation to the public, so it is the real one or it is
   not there.
   ───────────────────────────────────────────────────────────── */



export default function RecoveredCounter() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let live = true
    fetch('/api/recovered')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d) setData(d) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  if (!data || !data.totalRecovered) return null

  return (
    <section className="lp-section lp-recovered" aria-label="Recovered for clients">
      <div className="lp-container lp-recovered-inner">
        <div className="lp-eyebrow">Recovered for clients</div>
        <div className="lp-recovered-figure">{naira(data.totalRecovered)}</div>
        <p className="lp-recovered-note">
          {data.matterCount === 1
            ? 'Collected on one matter and confirmed received by the client.'
            : `Collected across ${data.matterCount} matters and confirmed received by the client.`}{' '}
          Updated as each recovery is confirmed.
        </p>
      </div>
    </section>
  )
}
