interface LogoProps {
  size?: number
  className?: string
  /** Use the white-ink monogram. Only for genuinely dark surfaces. */
  light?: boolean
}

// The firm's actual monogram, cropped from the official lockup (ink-only, transparent
// background). By default it follows the theme: black ink on the light canvas, white ink on
// the dark one (both are rendered and CSS shows one, so there's no flash). Pass `light` for a
// surface that is dark on both themes. See lib/pdfGenerator.js for the letterhead variant.
export function PandasLogoMark({ size = 36, className = '', light = false }: LogoProps) {
  const style = { height: size, width: 'auto', display: 'block' }
  if (light) return <img src="/logo-mark-light.png" alt="Pandas LP" className={className} style={style} />
  return (
    <>
      <img src="/logo-mark.png" alt="Pandas LP" className={`theme-light-only ${className}`.trim()} style={style} />
      <img src="/logo-mark-light.png" alt="" aria-hidden="true" className={`theme-dark-only ${className}`.trim()} style={style} />
    </>
  )
}

export function PandasLogoFull({ height = 32, className = '' }: { height?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
    >
      <PandasLogoMark size={height} />
      <span style={{
        fontFamily: 'var(--font-display), system-ui, sans-serif',
        fontWeight: 700,
        fontSize: height * 0.56,
        letterSpacing: '-0.025em',
        color: 'var(--text-1)',
        lineHeight: 1,
      }}>
        Pandas <span style={{ color: 'var(--accent)' }}>LP</span>
      </span>
    </span>
  )
}
