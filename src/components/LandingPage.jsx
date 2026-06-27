import ServiceCards from './ServiceCards'

export default function LandingPage({ onSelectService, onStartLawyerConsult, onStartCustomClaim }) {
  return (
    <>
      <section className="hero">
        <span className="badge fade-in">⚖️ AI-Powered Legal Documents for Nigeria</span>
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
      </section>

      <section className="section" id="services">
        <div className="container">
          <div className="step-header" style={{ textAlign: 'center' }}>
            <span className="label-mono">Our Services</span>
            <h2 style={{ marginTop: 8 }}>Choose what you need</h2>
          </div>
          <ServiceCards onSelectService={onSelectService} onStartLawyerConsult={onStartLawyerConsult} />
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container">
          <div className="banner">
            <span className="service-icon">📚</span>
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
