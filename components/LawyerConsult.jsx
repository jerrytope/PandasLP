'use client'

import { LAWYER_CONSULT_FEE } from '@/lib/services'

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || ''
const isCalendlyStubbed = !CALENDLY_URL || CALENDLY_URL.includes('placeholder')

export function LawyerConsultIntro({ onProceed, onBack }) {
  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">Speak to a Lawyer</span>
          <h2>Book a 1-on-1 Consultation</h2>
          <p>
            Get personalised legal advice from a licensed Nigerian legal practitioner in a 30-minute
            session.
          </p>
        </div>

        <div className="card card-gradient" style={{ maxWidth: 480 }}>
          <span className="service-price">Consultation fee</span>
          <h3 style={{ margin: '8px 0 16px', fontSize: 28 }}>₦{LAWYER_CONSULT_FEE.toLocaleString()}</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Payment is collected upfront. Once confirmed, you'll be taken straight to our booking
            calendar to pick a time that works for you.
          </p>
          <div className="row" style={{ marginTop: 20 }}>
            <button type="button" className="btn" onClick={onBack}>
              ← Back
            </button>
            <button type="button" className="btn btn-primary" onClick={onProceed}>
              Pay & Book Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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
