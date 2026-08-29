import { ImageResponse } from 'next/og'
import { PANDAS_LOGO_LIGHT_DATA_URI } from '@/lib/logoDataLight'

export const runtime = 'edge'

// Maskable icons get cropped to a circle/squircle/whatever shape a given Android launcher
// uses — content has to stay well inside a safe zone (roughly the center 80% by width) or it
// gets clipped. The logo here is sized to ~50% of canvas width, well within that margin,
// with the navy fill running full-bleed to the edges so there's no visible box/border once
// it's masked to a non-square shape.
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
          background: '#05070C',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PANDAS_LOGO_LIGHT_DATA_URI} width={256} height={169} alt="" />
      </div>
    ),
    { width: 512, height: 512 },
  )
}
