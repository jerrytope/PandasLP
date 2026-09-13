'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ChatPreview from './ChatPreview'
import Timeline from './Timeline'
import DocumentStack from './DocumentStack'
import { AGENT_PAGES } from '@/lib/agentPagesData'

/* ─────────────────────────────────────────────────────────────
   One template for every agent page.

   Six blocks, in the same order every time: status and price, a live
   chat preview, what it produces, the rule it enforces, what it will
   not do, then price and entry. A seventh agent is a new entry in
   lib/agentPagesData.js's AGENT_PAGES, not a new page type.

   The "will not do" block is the one that earns trust, so it gets the
   weight. Every refusal and escalation trigger here is lifted from
   lib/agentCapabilities.ts and lib/agents.ts. Nothing is invented.

   AGENT_PAGES itself lives in lib/agentPagesData.js, not here — this
   file has 'use client', and a Server Component reading a data export
   from a 'use client' module at module scope isn't a safe pattern in
   the App Router (see that file's own comment). Re-exported below so
   nothing that already imports { AGENT_PAGES } from this file breaks.
   ───────────────────────────────────────────────────────────── */

export { AGENT_PAGES }

export default function AgentPage({ slug }) {
  const router = useRouter()
  const a = AGENT_PAGES[slug]
  if (!a) return null

  const open = () => router.push(`/agent/${a.agentId}`)

  return (
    <>
      {/* breadcrumb */}
      <div className="lp-container ap-crumb">
        <Link href="/agents">Legal Agents</Link>
        <span aria-hidden="true"> / </span>
        <span className="is-here">{a.crumb}</span>
      </div>

      {/* hero + live preview */}
      <section className="lp-hero lp-container" aria-label={a.title}>
        <div className="lp-hero-grid">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">Live now &nbsp;·&nbsp; {a.price}</div>
            <h1 className="lp-h1">{a.title}</h1>
            <p className="lp-lede">{a.lede}</p>
          </div>
          <ChatPreview onOpenAgent={open} only={a.preview} />
        </div>
      </section>

      {/* what it produces */}
      <section className="lp-section lp-muted" aria-label="What it produces">
        <div className="lp-container">
          <h2 className="lp-h2 lp-section-head">
            {a.docs ? 'Nine instruments, one conversation.' : 'What it produces.'}
          </h2>

          {a.produces && (
            <div className="lp-chips">
              {a.produces.map((p) => <span key={p} className="lp-chip">{p}</span>)}
            </div>
          )}

          {a.docs && <DocumentStack docs={a.docs} />}

          {/* the rule this agent enforces */}
          <h3 className="ap-rule-head">{a.ruleTitle}</h3>

          {a.rail && <Timeline cells={a.rail} />}

          {a.ladder && (
            <>
              <div className="ap-ladder">
                {a.ladder.map((l) => (
                  <div key={l.k} className={l.on ? 'ap-ladder-cell is-on' : 'ap-ladder-cell'}>
                    <div className="lp-eyebrow">{l.k}</div>
                    <div className="ap-ladder-v">{l.v}</div>
                  </div>
                ))}
              </div>
              <p className="lp-note">{a.ladderNote}</p>
            </>
          )}
        </div>
      </section>

      {/* the film, debt page only */}
      {a.film && (
        <section className="lp-section lp-dark" aria-label="Film">
          <div className="lp-container ap-film">
            <div>
              <h2 className="lp-h2">{a.film.title}</h2>
              <p className="lp-lede">{a.film.body}</p>
            </div>
            {/* preload none so a 5MB file costs nothing until someone asks for it */}
            <video
              className="ap-video"
              controls
              preload="none"
              poster={a.film.poster}
              src={a.film.src}
            />
          </div>
        </section>
      )}

      {/* what it will not do */}
      <section className="lp-section lp-container" aria-label="Limits">
        <h2 className="lp-h2">What it will not do.</h2>
        <p className="lp-note ap-limits-note">
          Published in full. The refusals tell you more about whether to trust it than the capabilities do.
        </p>
        <div className="ap-limits">
          {a.limits.map((l, i) => (
            <div key={l.t} className={i < 2 ? 'ap-limit is-first' : 'ap-limit'}>
              <h3>{l.t}</h3>
              <p>{l.b}</p>
            </div>
          ))}
        </div>
        <Link href={`/agents/${slug}/limits`} className="lp-textlink" style={{ display: 'inline-block', marginTop: 16 }}>
          Read this on its own page →
        </Link>
      </section>

      {/* price and entry */}
      <section className="lp-section lp-muted" id="pricing" aria-label="Fees">
        <div className="lp-container">
          {a.fees.map((f, i) => (
            <div key={f.label} className={`lp-row${i === 0 ? ' lp-row-first' : ''}`}>
              <span style={{ color: f.muted ? 'var(--text-2)' : 'var(--text-1)' }}>{f.label}</span>
              <span className="lp-row-val" style={{ color: f.accent ? 'var(--accent)' : f.muted ? 'var(--text-2)' : 'var(--text-1)' }}>
                {f.value}
              </span>
            </div>
          ))}

          <div className="ap-close">
            <div className="ap-close-line">{a.close}</div>
            <button type="button" className="lp-cta lp-cta-dark" onClick={open}>{a.cta}</button>
          </div>
        </div>
      </section>
    </>
  )
}
