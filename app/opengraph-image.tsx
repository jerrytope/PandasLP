import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

// The share image, in "Ink & Brass" (docs/frontend-revamp-plan.md): ink background, cream type,
// one brass accent, and the light logo made for dark backgrounds.

export const alt = 'Pandas LP: debt recovery and property law in Nigeria'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#0B0A09'
const CREAM = '#EDE6D9'
const MUTED = '#A8A196'
const BRASS = '#E2B04A'
const LINE = 'rgba(237, 230, 217, 0.12)'

export default async function Image() {
  const logo = `data:image/png;base64,${(await readFile(join(process.cwd(), 'public', 'logo-mark-light.png'))).toString('base64')}`
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: INK, padding: '64px 72px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} height={52} alt="" />
          <span style={{ fontSize: 30, fontWeight: 700, color: CREAM, letterSpacing: '-0.02em' }}>
            Pandas <span style={{ color: BRASS, marginLeft: 8 }}>LP</span>
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1000 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 18, color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: BRASS, display: 'flex' }} />
            Debt recovery and property law · Nigeria
          </span>
          <span style={{ fontSize: 78, fontWeight: 600, color: CREAM, lineHeight: 1.02, letterSpacing: '-0.04em' }}>Tell us what happened.</span>
          <span style={{ fontSize: 78, fontWeight: 600, color: MUTED, lineHeight: 1.02, letterSpacing: '-0.04em' }}>We take it from there.</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${LINE}`, paddingTop: 22 }}>
          <span style={{ fontSize: 20, color: MUTED, letterSpacing: '0.04em' }}>Every document signed by a licensed practitioner</span>
          <span style={{ fontSize: 20, color: BRASS, letterSpacing: '0.08em' }}>CAC BN 9646741</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
