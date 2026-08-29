import { ImageResponse } from 'next/og'
import { PANDAS_LOGO_LIGHT_DATA_URI } from '@/lib/logoDataLight'

export const alt = 'Pandas LP: They owe you. We go after it.'
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
          background: '#05070C',
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
            background: 'radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0) 70%)',
            display: 'flex',
          }}
        />

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PANDAS_LOGO_LIGHT_DATA_URI} width={97} height={64} alt="" />
          <span style={{ fontSize: 30, fontWeight: 700, color: '#F3EFE3', letterSpacing: '-0.02em' }}>
            Pandas <span style={{ color: '#D4AF37' }}>LP</span>
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 980 }}>
          <span style={{ fontSize: 68, fontWeight: 700, color: '#F3EFE3', lineHeight: 1.08, letterSpacing: '-0.02em' }}>
            They owe you.
          </span>
          <span style={{ fontSize: 68, fontWeight: 700, color: '#D4AF37', lineHeight: 1.08, letterSpacing: '-0.02em' }}>
            We go after it.
          </span>
          <span style={{ fontSize: 26, color: '#ABB1A2', marginTop: 8 }}>
            Demand letter today. Court in 14 days if they ignore it.
          </span>
        </div>

        {/* Footer strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 3, background: '#D4AF37', display: 'flex' }} />
          <span style={{ fontSize: 20, color: '#ABB1A2', letterSpacing: '0.02em' }}>
            CAC BN 9646741 · A registered Lagos law firm
          </span>
        </div>
      </div>
    ),
    { ...size },
  )
}
