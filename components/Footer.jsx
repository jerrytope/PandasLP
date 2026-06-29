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
          Pandas LP is a legal technology platform that helps you prepare legal documents and
          connects you with licensed legal practitioners. We are not a law firm and the documents
          generated here do not constitute legal advice. For representation in court or complex
          matters, please use our "Speak to a Lawyer" service.
        </p>
        <p className="footer-disclaimer">© {new Date().getFullYear()} Pandas LP. All rights reserved.</p>
      </div>
    </footer>
  )
}
