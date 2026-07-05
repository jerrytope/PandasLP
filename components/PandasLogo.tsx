interface LogoProps {
  size?: number
  className?: string
}

// The firm's actual monogram (cropped from the official lockup, ink-only, transparent
// background). White ink for use on the site's dark navbar/footer; see lib/pdfGenerator.js
// for the black-ink variant used on the (white) letterhead.
export function PandasLogoMark({ size = 36, className = '' }: LogoProps) {
  return (
    <img
      src="/logo-mark-light.png"
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
