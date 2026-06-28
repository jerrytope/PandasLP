export default function Navbar({ onLogoClick, onNavServices, onStartLawyerConsult }) {
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <div className="logo" onClick={onLogoClick}>
          <span>
            Pandas <span className="accent">LP</span>
          </span>
          <span className="logo-tagline">Professional Legal Services, Powered by AI</span>
        </div>
        <nav className="nav-links">
          <a onClick={onNavServices}>Services</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#contact">Contact</a>
        </nav>
        <button type="button" className="btn btn-primary" onClick={onStartLawyerConsult}>
          Speak to a Lawyer
        </button>
      </div>
    </header>
  )
}
