import Link from 'next/link'

export default function Navbar({ onLogoClick, onNavServices, onStartLawyerConsult, user, onAuthClick }) {
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <div className="logo" onClick={onLogoClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onLogoClick?.()}>
          <span>
            Pandas <span className="accent">LP</span>
          </span>
          <span className="logo-tagline">Professional Legal Services, Powered by AI</span>
        </div>

        <nav className="nav-links">
          <a onClick={onNavServices} style={{ cursor: 'pointer' }}>Services</a>
          <a href="#how-it-works">How It Works</a>
          <Link href="/blog">Resources</Link>
          <a href="#contact">Contact</a>
        </nav>

        <div className="nav-actions">
          {user ? (
            <Link href="/dashboard" className="btn btn-ghost" style={{ fontSize: 14 }}>
              My Cases
            </Link>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={onAuthClick} style={{ fontSize: 14 }}>
              Sign In
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onStartLawyerConsult}>
            Speak to a Lawyer
          </button>
        </div>
      </div>
    </header>
  )
}
