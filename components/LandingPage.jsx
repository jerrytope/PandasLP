import ServicesSection from './ServicesSection'
import Reveal from './Reveal'

export default function LandingPage({ onOpenAgent, onStartLawyerConsult, onStartCustomClaim }) {
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="badge fade-in">AI-Powered Legal Documents for Nigeria</span>
            <h1 className="fade-in" style={{ animationDelay: '0.1s' }}>
              Professional legal work, <span className="accent">drafted by AI.</span>
            </h1>
            <p className="fade-in" style={{ animationDelay: '0.2s' }}>
              Five specialist AI agents draft court-ready documents from a real conversation —
              or connect you directly with a licensed Nigerian lawyer.
            </p>
            <div className="hero-actions fade-in" style={{ animationDelay: '0.3s' }}>
              <a href="#services">
                <button type="button" className="btn btn-primary">
                  Get Started
                </button>
              </a>
              <button type="button" className="btn" onClick={onStartLawyerConsult}>
                Speak to a Lawyer
              </button>
            </div>
            <div className="hero-trust fade-in" style={{ animationDelay: '0.4s' }}>
              <span>5 AI Legal Agents</span>
              <span className="hero-trust-dot" />
              <span>Nigerian Law Templates</span>
              <span className="hero-trust-dot" />
              <span>Instant PDF Drafts</span>
            </div>
          </div>
          <div className="hero-panda fade-in" style={{ animationDelay: '0.15s' }}>
            <img src="/panda-hero.svg" alt="Pandas LP mascot in a suit with a gavel" />
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="container">
          <ServicesSection onOpenAgent={onOpenAgent} />
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container">
          <Reveal>
            <div className="banner">
              <h2 style={{ margin: 0 }}>We handle all types of claims</h2>
              <p style={{ color: 'var(--text-muted)', maxWidth: 520 }}>
                Don't see your case above? Describe your situation and we'll route it to a lawyer
                who can help.
              </p>
              <button type="button" className="btn btn-primary" onClick={onStartCustomClaim}>
                Tell us about it →
              </button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
