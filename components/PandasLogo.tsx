interface LogoProps {
  size?: number
  className?: string
  /** Use the white-ink monogram. Only for genuinely dark surfaces. */
  light?: boolean
}

// The firm's actual monogram, cropped from the official lockup (ink-only, transparent
// background). Black ink is the default because every surface that renders this — the
// navbar and the footer — sits on --bg-0 ivory. Pass `light` for a dark surface.
// See lib/pdfGenerator.js for the letterhead variant.
export function PandasLogoMark({ size = 36, className = '', light = false }: LogoProps) {
  return (
    <img
      src={light ? '/logo-mark-light.png' : '/logo-mark.png'}
      alt="Pandas LP"
      className={className}
      style={{ height: size, width: 'auto', display: 'block' }}
    />
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
