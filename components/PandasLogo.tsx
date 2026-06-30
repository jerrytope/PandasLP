interface LogoProps {
  size?: number
  className?: string
}

export function PandasLogoMark({ size = 36, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Pandas LP"
    >
      {/* Badge background */}
      <rect width="40" height="40" rx="10" fill="#0F1612" />
      <rect width="40" height="40" rx="10" fill="url(#logo-border)" opacity="0.4" />

      {/* Ears */}
      <circle cx="11" cy="11.5" r="7" fill="#E8EAE9" />
      <circle cx="29" cy="11.5" r="7" fill="#E8EAE9" />
      {/* Ear inner — amber brand accent */}
      <circle cx="11" cy="11.5" r="3.5" fill="#F5A623" />
      <circle cx="29" cy="11.5" r="3.5" fill="#F5A623" />

      {/* Face */}
      <circle cx="20" cy="25" r="13.5" fill="#E8EAE9" />

      {/* Eye patches */}
      <ellipse cx="15" cy="23" rx="4.2" ry="4.8" fill="#080C0A" transform="rotate(-8 15 23)" />
      <ellipse cx="25" cy="23" rx="4.2" ry="4.8" fill="#080C0A" transform="rotate(8 25 23)" />

      {/* Eyes (white catch-light) */}
      <circle cx="15" cy="23" r="1.9" fill="#E8EAE9" />
      <circle cx="25" cy="23" r="1.9" fill="#E8EAE9" />

      {/* Pupils */}
      <circle cx="15.5" cy="23.4" r="0.85" fill="#080C0A" />
      <circle cx="25.5" cy="23.4" r="0.85" fill="#080C0A" />

      {/* Nose */}
      <ellipse cx="20" cy="28.5" rx="2.4" ry="1.6" fill="#080C0A" />

      <defs>
        <linearGradient id="logo-border" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5A623" />
          <stop offset="1" stopColor="#3ECF8E" />
        </linearGradient>
      </defs>
    </svg>
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
