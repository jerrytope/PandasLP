import { ImageResponse } from 'next/og'
import { PANDAS_LOGO_DATA_URI } from '@/lib/logoData'

export const runtime = 'edge'

// Standard (non-maskable) app icon — same ivory/monogram treatment as app/opengraph-image.tsx,
// just square and sized for the manifest's "any" purpose entry.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAFAF8',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PANDAS_LOGO_DATA_URI} width={120} height={79} alt="" />
      </div>
    ),
    { width: 192, height: 192 },
  )
}
