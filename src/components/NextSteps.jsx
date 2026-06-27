export default function NextSteps({ service, onUpgrade, onBackToLanding }) {
  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">What happens next</span>
          <h2>Choose how you'd like to proceed</h2>
        </div>

        <div className="two-col">
          <div className="card card-gradient fade-in">
            <span className="label-mono">Option 1</span>
            <h3 style={{ marginTop: 8 }}>File It Yourself (DIY)</h3>
            <p style={{ color: 'var(--text-muted)' }}>{service.filingInstructions}</p>
          </div>

          <div className="card card-gradient fade-in" style={{ animationDelay: '0.1s' }}>
            <span className="label-mono">Option 2</span>
            <h3 style={{ marginTop: 8 }}>Firm-Managed Filing</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Let a Pandas LP lawyer review, file, and follow up on your matter on your behalf.
            </p>
            <button type="button" className="btn btn-primary btn-block" onClick={onUpgrade}>
              Upgrade to Firm-Managed Filing
            </button>
          </div>
        </div>

        <div className="banner" style={{ marginTop: 32 }}>
          <span className="service-icon">📚</span>
          <p style={{ color: 'var(--text-muted)' }}>We handle all types of claims — not just this one.</p>
          <button type="button" className="btn" onClick={onBackToLanding}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
