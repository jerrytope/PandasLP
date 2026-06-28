'use client'

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || ''
const isCalendlyStubbed = !CALENDLY_URL || CALENDLY_URL.includes('placeholder')

export function LawyerConsultBooking({ onBackToLanding }) {
  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">Payment confirmed</span>
          <h2>Pick a Time for Your Session</h2>
          <p>Choose a slot below and you'll receive a confirmation email shortly.</p>
        </div>

        {isCalendlyStubbed ? (
          <div className="card" style={{ maxWidth: 480 }}>
            <span className="badge badge-test">Calendly Not Configured</span>
            <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>
              Booking calendar will appear here once a Calendly link is added to NEXT_PUBLIC_CALENDLY_URL.
              Our team will reach out by email to schedule your session in the meantime.
            </p>
          </div>
        ) : (
          <iframe title="Calendly booking" src={CALENDLY_URL} className="pdf-frame" style={{ height: 700 }} />
        )}

        <button type="button" className="btn" style={{ marginTop: 20 }} onClick={onBackToLanding}>
          Back to Home
        </button>
      </div>
    </div>
  )
}
