import { notFound } from 'next/navigation'
import Link from 'next/link'
import { STATES, getStateBySlug } from '@/lib/locations'
import { safeJsonLd } from '@/lib/jsonLd'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ state: string }>
}

export async function generateStaticParams() {
  return STATES.map((s) => ({ state: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state: slug } = await params
  const state = getStateBySlug(slug)
  if (!state) return {}
  const title = `How to Recover a Debt in ${state.name} — Small Claims Guide 2026`
  const description = `A step-by-step guide to recovering money owed to you through the ${state.name} Small Claims Court — claim limits, the filing process, and what to expect.`
  return {
    title,
    description,
    alternates: { canonical: `/recover-debt/${state.slug}` },
    // Unverified pages stay reachable (footer link, direct URL) but must not show up in
    // search results until a human confirms the figures against the actual registry — see
    // lib/locations.ts's `verified` field.
    robots: { index: state.verified, follow: true },
    openGraph: {
      type: 'article',
      title: `${title} — Pandas LP`,
      description,
      url: `/recover-debt/${state.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Pandas LP`,
      description,
    },
  }
}

export default async function RecoverDebtStatePage({ params }: Props) {
  const { state: slug } = await params
  const state = getStateBySlug(slug)
  if (!state) notFound()

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: state.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />
      <header className="navbar" role="banner">
        <div className="container navbar-inner">
          <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
            Pandas <span className="accent">LP</span>
          </Link>
          <Link href="/blog" className="btn btn-ghost" style={{ fontSize: 14 }}>← Resources</Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <article style={{ maxWidth: 680, margin: '0 auto' }}>
          <span className="label-mono" style={{ color: 'var(--accent-hover)' }}>Debt Recovery · {state.name}</span>

          <h1 style={{
            margin: '8px 0 32px',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.5vw,44px)',
            fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.12,
          }}>
            How to Recover a Debt in {state.name}
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 32 }}>
            If someone in {state.name} owes you money and refuses to pay, the Small Claims Court gives you a
            faster, cheaper route than a full civil suit — designed so you can represent yourself, without a lawyer
            in the hearing itself.
          </p>

          <div className="card" style={{ padding: '24px 28px', marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 18 }}>At a glance</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--text-2)' }}>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Claim limit:</strong> ₦{state.claimLimit.toLocaleString()}
                {state.claimLimitNote && (
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {state.claimLimitNote}
                  </span>
                )}
              </div>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Courts:</strong> {state.courtInfo}
              </div>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Response period:</strong>{' '}
                {state.responsePeriodDays
                  ? `The person you're claiming from has ${state.responsePeriodDays} days to respond to your Letter of Demand before you can escalate.`
                  : "Your state's Small Claims Court practice direction sets the response window for a Letter of Demand."}
              </div>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Filing fee:</strong> Assessed at the registry based on
                your claim amount.
              </div>
            </div>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>The process</h2>
          <ol style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--text-2)', paddingLeft: 20, marginBottom: 40 }}>
            <li>Send a written Letter of Demand to the person who owes you, stating the amount and a deadline to pay.</li>
            <li>If they don't pay within the response period, file a claim at the Small Claims Court covering their address, workplace, or place of business.</li>
            <li>The court hears the matter with simplified procedure — no formal pleadings, plain English, no lawyers required.</li>
            <li>If you win, the court issues a judgment. If it's still not paid, you can apply to enforce it.</li>
          </ol>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Frequently asked questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
            {state.faqs.map((f) => (
              <div key={f.question} className="card" style={{ padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{f.question}</h3>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{f.answer}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{
            padding: '32px',
            background: 'linear-gradient(135deg,rgba(214, 187, 128, 0.12),rgba(31, 52, 70, 0.5))',
            borderColor: 'rgba(214, 187, 128, 0.3)',
            textAlign: 'center',
          }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 22 }}>
              Ready to take action?
            </h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', fontSize: 14, lineHeight: 1.65 }}>
              We interview you, draft your Letter of Demand on firm letterhead, and file at the Small Claims Court
              on your behalf — from ₦10,000.
            </p>
            <Link href="/agent/small-claims" className="btn btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              Start Your Claim →
            </Link>
          </div>
        </article>
      </main>
      <WhatsAppFab />
    </div>
  )
}
