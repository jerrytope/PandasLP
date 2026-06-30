import ServicesSection from './ServicesSection'
import Reveal from './Reveal'

export default function LandingPage({ onOpenAgent, onStartLawyerConsult, onStartCustomClaim }) {
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="badge fade-in">AI-Native Nigerian Law Firm</span>
            <h1 className="fade-in" style={{ animationDelay: '0.1s' }}>
              Someone owes you money. <span className="accent">We get it back.</span>
            </h1>
            <p className="fade-in" style={{ animationDelay: '0.2s' }}>
              Pandas LP is a registered Nigerian law firm. Our AI agent drafts your Letter of Demand,
              serves it on the debtor, and files your Small Claims Court case — all from one conversation.
            </p>
            <div className="hero-actions fade-in" style={{ animationDelay: '0.3s' }}>
              <a href="#services">
                <button type="button" className="btn btn-primary">
                  Start Your Claim →
                </button>
              </a>
              <button type="button" className="btn" onClick={onStartLawyerConsult}>
                Speak to a Lawyer
              </button>
            </div>
            <div className="hero-trust fade-in" style={{ animationDelay: '0.4s' }}>
              <span>CAC Registered</span>
              <span className="hero-trust-dot" />
              <span>Court Filing Included</span>
              <span className="hero-trust-dot" />
              <span>From ₦10,000</span>
            </div>
          </div>
          <div className="hero-panda fade-in" style={{ animationDelay: '0.15s' }}>
            <img src="/panda-hero.svg" alt="Pandas LP mascot in a suit with a gavel" />
          </div>
        </div>
      </section>

      <section className="escalation-path">
        <div className="container">
          <Reveal>
            <p className="label-mono" style={{ textAlign: 'center', marginBottom: 32 }}>How it works</p>
            <div className="escalation-steps">
              <div className="escalation-step">
                <div className="escalation-num">01</div>
                <div className="escalation-body">
                  <div className="escalation-title">AI Interview</div>
                  <div className="escalation-desc">Our agent asks the right questions — or reads your uploaded documents — to build your case.</div>
                </div>
              </div>
              <div className="escalation-arrow">→</div>
              <div className="escalation-step">
                <div className="escalation-num">02</div>
                <div className="escalation-body">
                  <div className="escalation-title">Letter Drafted & Served</div>
                  <div className="escalation-desc">We draft your Letter of Demand on firm letterhead and serve it on the other party on your behalf.</div>
                </div>
              </div>
              <div className="escalation-arrow">→</div>
              <div className="escalation-step">
                <div className="escalation-num">03</div>
                <div className="escalation-body">
                  <div className="escalation-title">7-Day Deadline</div>
                  <div className="escalation-desc">The debtor has 7 days to respond. We track the deadline and notify you automatically.</div>
                </div>
              </div>
              <div className="escalation-arrow">→</div>
              <div className="escalation-step">
                <div className="escalation-num">04</div>
                <div className="escalation-body">
                  <div className="escalation-title">Court Filing</div>
                  <div className="escalation-desc">No response? We escalate — filing your claim at the Small Claims Court and representing you.</div>
                </div>
              </div>
            </div>
          </Reveal>
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
