import { ImageResponse } from 'next/og'
import { PANDAS_LOGO_DATA_URI } from '@/lib/logoData'

export const alt = 'Pandas LP: debt recovery and property law in Lagos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#FAFAF8',
          padding: '64px 72px',
          position: 'relative',
        }}
      >
        {/* Gold glow accent */}
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -140,
            width: 560,
            height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(184,134,11,0.18) 0%, rgba(184,134,11,0) 70%)',
            display: 'flex',
          }}
        />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PANDAS_LOGO_DATA_URI} width={97} height={64} alt="" />
          <span style={{ fontSize: 30, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
            Pandas <span style={{ color: '#B8860B' }}>LP</span>
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 980 }}>
          <span style={{ fontSize: 68, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
            Tell us what happened.
          </span>
          <span style={{ fontSize: 68, fontWeight: 500, color: '#B8860B', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
            We take it from there.
          </span>
          <span style={{ fontSize: 26, color: '#6B6B6B', marginTop: 8 }}>
            Debt recovery and property law. Every document signed by a licensed practitioner.
          </span>
        </div>

        {/* Footer strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 1, background: '#B8860B', display: 'flex' }} />
          <span style={{ fontSize: 20, color: '#6B6B6B', letterSpacing: '0.02em' }}>
            CAC BN 9646741 · A registered Lagos law firm
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
