import Link from 'next/link'
import { BLOG_POSTS } from '@/lib/blogPosts'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'

const TITLE = 'Legal Resources'
const DESCRIPTION = 'Plain-English guides on Nigerian debt recovery, Letters of Demand, Small Claims Court, and your legal rights.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    title: `${TITLE} — Pandas LP`,
    description: DESCRIPTION,
    url: '/blog',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} — Pandas LP`,
    description: DESCRIPTION,
  },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogIndexPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <header className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
            Pandas <span className="accent">LP</span>
          </Link>
          <Link href="/" className="btn btn-ghost" style={{ fontSize: 14 }}>← Home</Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <span className="label-mono">Legal Resources</span>
          <h1 style={{
            marginTop: 8, marginBottom: 12,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px,5vw,52px)',
            fontWeight: 700, letterSpacing: '-0.02em',
          }}>
            Know your rights.<br />
            <span style={{ color: 'var(--accent)' }}>Get what you're owed.</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 17, marginBottom: 56, lineHeight: 1.6 }}>
            Plain-English guides on Nigerian law — written by our legal team so you can understand your options before spending a naira.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {BLOG_POSTS.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                <div className="card card-interactive" style={{ padding: '28px 32px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                    <span className="label-mono" style={{ color: 'var(--accent-hover)' }}>{post.category}</span>
                    <span className="hero-trust-dot" />
                    <span className="label-mono">{post.readTime}</span>
                    <span className="hero-trust-dot" />
                    <span className="label-mono">{formatDate(post.date)}</span>
                  </div>
                  <h2 style={{
                    margin: '0 0 10px',
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(18px,2.2vw,22px)',
                    fontWeight: 600, letterSpacing: '-0.01em',
                  }}>
                    {post.title}
                  </h2>
                  <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.65 }}>
                    {post.description}
                  </p>
                  <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600 }}>Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <WhatsAppFab />
    </div>
  )
}
