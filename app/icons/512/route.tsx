import { ImageResponse } from 'next/og'
import { PANDAS_LOGO_DATA_URI } from '@/lib/logoData'

export const runtime = 'edge'

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
        <img src={PANDAS_LOGO_DATA_URI} width={320} height={211} alt="" />
      </div>
    ),
    { width: 512, height: 512 },
  )
}
