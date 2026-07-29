import { ImageResponse } from 'next/og'
import { BLOG_POSTS, getPostBySlug } from '@/lib/blogPosts'
import { PANDAS_LOGO_LIGHT_DATA_URI } from '@/lib/logoDataLight'

export const alt = 'Pandas LP: Legal Resources'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  // Satori's default font has no ₦ glyph (same gap lib/pdfGenerator.js works around for PDFs)
  // and relying on Next's automatic Google Fonts fallback fetch isn't reliable enough here.
  const title = (post?.title ?? 'Pandas LP Legal Resources').replace(/₦/g, 'N')
  const category = post?.category ?? 'Legal Resources'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#182A3A',
          padding: '64px 72px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            left: -140,
            width: 560,
            height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(214,187,128,0.3) 0%, rgba(214,187,128,0) 70%)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PANDAS_LOGO_LIGHT_DATA_URI} width={81} height={53} alt="" />
          <span style={{ fontSize: 24, fontWeight: 700, color: '#F3EFE3', letterSpacing: '-0.02em' }}>
            Pandas <span style={{ color: '#D6BB80' }}>LP</span>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#D6BB80',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {category}
          </span>
          <span style={{ fontSize: 54, fontWeight: 700, color: '#F3EFE3', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            {title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 3, background: '#D6BB80', display: 'flex' }} />
          <span style={{ fontSize: 20, color: '#ABB1A2', letterSpacing: '0.02em' }}>
            pandaslp.com.ng
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
