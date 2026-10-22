'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { currentTheme, setTheme, type Theme } from '@/lib/theme'

// The sun/moon switch. Both icons are always rendered and CSS shows the right one
// (.theme-light-only / .theme-dark-only), so the server HTML matches whatever theme the
// head script already applied: no flash, no hydration mismatch.
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme | null>(null)

  useEffect(() => {
    const sync = () => setThemeState(currentTheme())
    sync()
    // The head script flips the theme when the device changes; keep the label honest.
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={() => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      <Moon className="theme-light-only" size={17} strokeWidth={1.8} aria-hidden="true" />
      <Sun className="theme-dark-only" size={17} strokeWidth={1.8} aria-hidden="true" />
    </button>
  )
}
