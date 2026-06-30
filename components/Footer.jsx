export default function Footer() {
  return (
    <footer className="footer" id="contact">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="logo">
              Pandas <span className="accent">LP</span>
            </div>
            <p className="label-mono" style={{ marginTop: 8 }}>
              Professional Legal Services, Powered by AI
            </p>
          </div>
          <div>
            <p className="label-mono">Contact</p>
            <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>pandaslegalpractitioners@gmail.com</p>
            <p style={{ color: 'var(--text-muted)' }}>+234 811 808 0189</p>
          </div>
        </div>
        <p className="footer-disclaimer">
          Pandas LP is an AI-native law firm. Our AI agents conduct a guided interview and draft
          your documents from real Nigerian legal templates — for select documents, like a Letter
          of Demand, we can also serve it on the other party on your behalf. Where you need a
          licensed legal practitioner to advise, file, or represent you in court, our lawyers are
          available through the "Speak to a Lawyer" service. AI-generated documents are prepared
          for your use and do not substitute for advice from a licensed legal practitioner.
        </p>
        <p className="footer-disclaimer">© {new Date().getFullYear()} Pandas LP. All rights reserved.</p>
      </div>
    </footer>
  )
}
