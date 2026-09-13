import { notFound } from 'next/navigation'
import Link from 'next/link'
import { LAGOS_PROPERTY_DISTRICTS, getLagosPropertyDistrictBySlug } from '@/lib/lagosPropertyDistricts'
import { getPostBySlug } from '@/lib/blogPosts'
import { AGENT_PAGES } from '@/lib/agentPagesData'
import { safeJsonLd } from '@/lib/jsonLd'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ district: string }>
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'

// The eviction post already has real, accurate FAQ copy on this exact topic — reused here
// rather than rewritten, so the two pages can never say two different things about the same
// question. See lib/blogPosts.ts's 'how-to-evict-a-tenant-legally-in-lagos' post.
const EVICTION_POST_SLUG = 'how-to-evict-a-tenant-legally-in-lagos'

export async function generateStaticParams() {
  return LAGOS_PROPERTY_DISTRICTS.map((d) => ({ district: d.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { district: slug } = await params
  const district = getLagosPropertyDistrictBySlug(slug)
  if (!district) return {}
  const title = `Recovery of Premises Lawyer in ${district.name}, Lagos`
  const description = `Notice to Quit and recovery of possession, drafted and signed by a licensed Nigerian legal practitioner, for property in ${district.name}. From ₦25,000.`
  return {
    title,
    description,
    alternates: { canonical: `/recover-premises/lagos/${district.slug}` },
    // Same gate as /recover-debt/lagos/[district]: reachable by URL, excluded from search
    // results and the sitemap until a human confirms this district's court details — see
    // lib/lagosPropertyDistricts.ts's `verified` field.
    robots: { index: district.verified, follow: true },
    openGraph: {
      type: 'article',
      title: `${title} | Pandas LP`,
      description,
      url: `/recover-premises/lagos/${district.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Pandas LP`,
      description,
    },
  }
}

export default async function RecoverPremisesLagosDistrictPage({ params }: Props) {
  const { district: slug } = await params
  const district = getLagosPropertyDistrictBySlug(slug)
  const propertyAgent = AGENT_PAGES['property-law']
  const evictionPost = getPostBySlug(EVICTION_POST_SLUG)
  if (!district || !propertyAgent || !evictionPost?.faqs) notFound()

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: evictionPost.faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Property Law', item: `${SITE_URL}/agents/property-law` },
      { '@type': 'ListItem', position: 2, name: 'Lagos', item: `${SITE_URL}/recover-premises/lagos` },
      { '@type': 'ListItem', position: 3, name: district.name, item: `${SITE_URL}/recover-premises/lagos/${district.slug}` },
    ],
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />

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
          <span className="label-mono" style={{ color: 'var(--accent-hover)' }}>
            Property Law · {district.name}, Lagos
          </span>

          <h1 style={{
            margin: '8px 0 32px',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.5vw,44px)',
            fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.12,
          }}>
            Recovery of Premises in {district.name}, Lagos
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-2)', marginBottom: 32 }}>
            Nigerian law doesn't give a landlord in {district.name} a power of eviction — it gives a procedure for
            recovery of possession, built around two notices and a court application, not a change of the locks.
          </p>

          <div className="card" style={{ padding: '24px 28px', marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 18 }}>At a glance</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--text-2)' }}>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Court:</strong> {district.registryNote}
              </div>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Notice period:</strong> Fixed by how the tenancy runs, set
                out in full below. A notice shorter than the statutory period is void — the most common and most
                expensive mistake in a recovery of premises.
              </div>
              <div>
                <strong style={{ color: 'var(--text-1)' }}>Documents involved:</strong> A Notice to Quit, then —
                only once it has expired — the separate Seven Days' Notice of Owner's Intention to Apply to Recover
                Possession. They cannot be combined into one document.
              </div>
            </div>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Notice periods by tenancy type</h2>
          <div className="table-scroll" style={{ marginBottom: 40 }}>
            <table>
              <thead><tr><th>Type of tenancy</th><th>Notice required</th></tr></thead>
              <tbody>
                {propertyAgent.ladder.map((l) => (
                  <tr key={l.k}><td>{l.k}</td><td>{l.v}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Frequently asked questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
            {evictionPost.faqs.map((f) => (
              <div key={f.question} className="card" style={{ padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>{f.question}</h3>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>{f.answer}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{
            padding: '32px',
            background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-2))',
            borderColor: 'rgba(184, 134, 11, 0.25)',
            textAlign: 'center',
          }}>
            <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 22 }}>
              Ready to take action?
            </h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', fontSize: 14, lineHeight: 1.65 }}>
              We work out which notice your tenancy actually needs, draft it, and a licensed practitioner signs it
              before it's served — each tenancy or lease document is ₦25,000.
            </p>
            <Link href="/agent/recovery-of-premises" className="btn btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              Start Your Matter →
            </Link>
          </div>
        </article>
      </main>
      <WhatsAppFab />
    </div>
  )
}
