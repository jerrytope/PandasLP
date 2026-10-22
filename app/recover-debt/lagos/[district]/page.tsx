import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getStateBySlug } from '@/lib/locations'
import { LAGOS_DISTRICTS, getLagosDistrictBySlug } from '@/lib/lagosDistricts'
import { safeJsonLd } from '@/lib/jsonLd'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

interface Props {
  params: Promise<{ district: string }>
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'

export async function generateStaticParams() {
  return LAGOS_DISTRICTS.map((d) => ({ district: d.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { district: slug } = await params
  const district = getLagosDistrictBySlug(slug)
  if (!district) return {}
  const filingDistrict = district.filesUnderDistrict ?? district.name
  const title = `Debt Recovery Lawyer in ${district.name}, Lagos`
  const description = `A Letter of Demand drafted and signed by a licensed Nigerian legal practitioner, filed at the ${filingDistrict} Small Claims Court registry. From ₦10,000.`
  return {
    title,
    description,
    alternates: { canonical: `/recover-debt/lagos/${district.slug}` },
    // Same gate as /recover-debt/[state]: reachable by URL, but excluded from search results
    // and the sitemap until a human confirms this district's registry details — see
    // lib/lagosDistricts.ts's `verified` field.
    robots: { index: district.verified, follow: true },
    openGraph: {
      type: 'article',
      title: `${title} | Pandas LP`,
      description,
      url: `/recover-debt/lagos/${district.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Pandas LP`,
      description,
    },
  }
}

export default async function RecoverDebtLagosDistrictPage({ params }: Props) {
  const { district: slug } = await params
  const district = getLagosDistrictBySlug(slug)
  const lagos = getStateBySlug('lagos')
  if (!district || !lagos) notFound()

  // Lekki/Ikoyi/Victoria Island are real, searched-for Lagos areas but not themselves one of
  // the seven official magisterial districts — see lib/lagosDistricts.ts's filesUnderDistrict
  // comment. Every "file at ___" mention below uses this, never district.name, so the page
  // never implies a standalone court that may not exist.
  const filingDistrict = district.filesUnderDistrict ?? district.name

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: lagos.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Debt Recovery', item: `${SITE_URL}/agents/debt-recovery` },
      { '@type': 'ListItem', position: 2, name: 'Lagos', item: `${SITE_URL}/recover-debt/lagos` },
      { '@type': 'ListItem', position: 3, name: district.name, item: `${SITE_URL}/recover-debt/lagos/${district.slug}` },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />

      <Navbar />

      <main className="container" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <article style={{ maxWidth: 680, margin: '0 auto' }}>
          <span className="label-mono" style={{ color: 'var(--accent-hover)' }}>
            Debt Recovery · {district.name}, Lagos
          </span>

          <h1 style={{
            margin: '8px 0 32px',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.5vw,44px)',
            fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.12,
          }}>
            Debt Recovery for {district.name} Residents and Businesses
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 32 }}>
            If someone in {district.name} owes you money and refuses to pay, the Small Claims Court gives you a
            faster, cheaper route than a full civil suit, designed so you can represent yourself, without a lawyer
            in the hearing itself.
          </p>

          <div className="card" style={{ padding: '24px 28px', marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 18 }}>At a glance</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--text-2)' }}>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Claim limit:</strong> ₦{lagos.claimLimit.toLocaleString()}
                <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  Set by Lagos State's Small Claims Court Practice Direction — the same limit applies across every
                  magisterial district in the state, {district.name} included.
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Registry:</strong> {district.registryNote}
              </div>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Response period:</strong>{' '}
                The person you're claiming from has {lagos.responsePeriodDays} days to respond to your Letter of
                Demand before you can file.
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
            <li>If they don't pay within {lagos.responsePeriodDays} days, file a claim at the {filingDistrict} registry.</li>
            <li>The court hears the matter with simplified procedure: no formal pleadings, plain English, no lawyers required.</li>
            <li>If you win, the court issues a judgment. If it's still not paid, you can apply to enforce it.</li>
          </ol>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Frequently asked questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
            {lagos.faqs.map((f) => (
              <div key={f.question} className="card" style={{ padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{f.question}</h3>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{f.answer}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{
            padding: '32px',
            background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-2))',
            borderColor: 'rgba(var(--accent-rgb),  0.25)',
            textAlign: 'center',
          }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 22 }}>
              Ready to take action?
            </h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', fontSize: 14, lineHeight: 1.65 }}>
              We interview you, draft your Letter of Demand on firm letterhead, and file at the {filingDistrict}
              registry on your behalf, from ₦10,000.
            </p>
            <Link href="/agent/small-claims" className="btn btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              Start Your Claim →
            </Link>
          </div>
        </article>
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  )
}
