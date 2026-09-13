'use client'

import Link from 'next/link'
import { AGENT_PAGES } from '@/lib/agentPagesData'

/* ─────────────────────────────────────────────────────────────
   The "what it will not do" block from AgentPage.jsx, given its own
   URL and FAQPage schema instead of living only as one section on
   the main agent page.

   Nothing here is new copy — a.limits is the exact same array
   AgentPage.jsx already renders, so the two pages can never drift
   out of sync with each other. This page exists because a section
   halfway down a longer page isn't independently linkable or
   citable; a standalone page with a direct URL is both.
   ───────────────────────────────────────────────────────────── */

export default function AgentLimitsPage({ slug }) {
  const a = AGENT_PAGES[slug]
  if (!a) return null

  return (
    <div className="lp-container" style={{ paddingTop: 64, paddingBottom: 96 }}>
      <div className="ap-crumb" style={{ paddingLeft: 0, paddingTop: 0, border: 'none' }}>
        <Link href="/agents">Legal Agents</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/agents/${slug}`}>{a.crumb}</Link>
        <span aria-hidden="true"> / </span>
        <span className="is-here">What it will not do</span>
      </div>

      <article style={{ maxWidth: 680, marginTop: 24 }}>
        <span className="lp-eyebrow">{a.crumb} · AI Agent</span>
        <h1 className="lp-h1" style={{ fontSize: 'clamp(26px,4vw,38px)' }}>
          Where the AI stops and a lawyer starts
        </h1>
        <p className="lp-lede" style={{ maxWidth: '60ch' }}>
          Every refusal below is a real, deliberate boundary built into the {a.title.toLowerCase()} agent — lifted
          directly from what it's actually instructed to do, not written after the fact for this page. Published in
          full, because the refusals tell you more about whether to trust it than the capabilities do.
        </p>

        <div className="ap-limits" style={{ marginTop: 40 }}>
          {a.limits.map((l, i) => (
            <div key={l.t} className={i < 2 ? 'ap-limit is-first' : 'ap-limit'}>
              <h3>{l.t}</h3>
              <p>{l.b}</p>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginTop: 48, padding: '28px 32px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--text-muted)' }}>
            Every document it drafts is reviewed and signed by a licensed Nigerian legal practitioner before it goes
            anywhere.
          </p>
          <Link href={`/agents/${slug}`} className="btn btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            See what it produces →
          </Link>
        </div>
      </article>
    </div>
  )
}
