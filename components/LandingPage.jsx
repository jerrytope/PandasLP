import ServicesSection from './ServicesSection'

export default function LandingPage({ onOpenAgent, onStartLawyerConsult, onStartCustomClaim }) {
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="badge fade-in">AI-Powered Legal Documents for Nigeria</span>
            <h1 className="fade-in" style={{ animationDelay: '0.1s' }}>
              Professional Legal Services, <span className="accent">Powered by AI</span>
            </h1>
            <p className="fade-in" style={{ animationDelay: '0.2s' }}>
              Generate court-ready legal documents in minutes, or speak directly with a licensed
              lawyer — all from one platform.
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
          </div>
          <div className="hero-panda fade-in" style={{ animationDelay: '0.15s' }}>
            <img src="/panda-hero.svg" alt="Pandas LP mascot" />
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
        </div>
      </section>
    </>
  )
}
