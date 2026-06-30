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
          Pandas LP is a legal technology platform. Our AI agents conduct a guided interview and
          draft your document from real Nigerian legal templates — for select documents, like a
          Letter of Demand, we can also deliver it to the other party on your behalf as a paid
          logistics service. We are not a law firm, and nothing generated here constitutes legal
          advice. For legal advice or representation, use our "Speak to a Lawyer" service to
          connect with a licensed Nigerian legal practitioner.
        </p>
        <p className="footer-disclaimer">© {new Date().getFullYear()} Pandas LP. All rights reserved.</p>
      </div>
    </footer>
  )
}
