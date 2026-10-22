import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BLOG_POSTS, getPostBySlug } from '@/lib/blogPosts'
import { safeJsonLd } from '@/lib/jsonLd'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: `${post.title} | Pandas LP`,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.date,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} | Pandas LP`,
      description: post.description,
    },
  }
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pandaslp.com.ng'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: [
      { '@type': 'Person', name: 'Adebayo Sobayo' },
      { '@type': 'Person', name: 'Adeyemo Adedeji', jobTitle: 'Legal Practitioner' },
    ],
    publisher: {
      '@type': 'Organization',
      name: 'Pandas LP',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo-mark.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}` },
  }

  // Emitted only for posts that actually carry FAQs, and always alongside the visible
  // block rendered further down from the same array. Structured data describing content
  // a reader cannot see on the page is a manual-action risk, so the two never diverge.
  const faqJsonLd = post.faqs?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      }
    : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
        />
      )}
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
          {/* Meta */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <Link href="/blog" style={{ textDecoration: 'none' }}>
              <span className="label-mono" style={{ color: 'var(--accent-hover)' }}>{post.category}</span>
            </Link>
            <span className="hero-trust-dot" />
            <span className="label-mono">{post.readTime}</span>
            <span className="hero-trust-dot" />
            <span className="label-mono">{formatDate(post.date)}</span>
          </div>

          {/* Title */}
          <h1 style={{
            margin: '0 0 32px',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.5vw,44px)',
            fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.12,
          }}>
            {post.title}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: -20, marginBottom: 32 }}>
            Reviewed by <strong style={{ color: 'var(--text-2)' }}>{post.author}</strong>
          </p>

          {/* Content */}
          <div
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* The visible half of the FAQPage structured data above. Rendered from the same
              array, so what a search engine is told and what a reader sees cannot drift. */}
          {post.faqs?.length ? (
            <section className="blog-content" aria-labelledby="faq-heading" style={{ marginTop: 40 }}>
              <h2 id="faq-heading">Common questions</h2>
              {post.faqs.map((f) => (
                <div key={f.question} style={{ marginBottom: 20 }}>
                  <h3 style={{ marginBottom: 6 }}>{f.question}</h3>
                  <p style={{ margin: 0 }}>{f.answer}</p>
                </div>
              ))}
            </section>
          ) : null}

          {/* CTA */}
          <div className="card" style={{
            marginTop: 56, padding: '32px',
            background: 'linear-gradient(135deg,rgba(var(--accent-rgb),  0.08),color-mix(in srgb, var(--bg-1) 60%, transparent))',
            borderColor: 'rgba(var(--accent-rgb),  0.25)',
            textAlign: 'center',
          }}>
            <h2 style={{ margin: '0 0 10px', fontFamily: 'var(--font-display)', fontSize: 22 }}>
              Ready to take action?
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 24px', fontSize: 14, lineHeight: 1.65 }}>
              We interview you, draft your Letter of Demand on firm letterhead, and file at the Small Claims Court on your behalf, from ₦10,000.
            </p>
            <Link href="/#services" className="btn btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
              Start Your Claim →
            </Link>
          </div>
        </article>
      </main>
      <WhatsAppFab />
    </div>
  )
}
