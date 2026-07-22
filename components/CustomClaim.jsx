'use client'

import { useState } from 'react'

export default function CustomClaim({ onSubmit, onBack }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', description: '' })
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!values.name || !values.email || !values.description) {
      setError('Please fill in your name, email, and a description of your claim.')
      return
    }
    setError('')
    onSubmit(values)
  }

  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">We handle all types of claims</span>
          <h2>Tell Us About Your Claim</h2>
          <p>
            Describe your situation in your own words. We'll route it to a lawyer who can help,
            after a small routing fee.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 640 }}>
          <div className="form-group">
            <label htmlFor="claim-name">
              Full Name <span className="required">*</span>
            </label>
            <input
              id="claim-name"
              className="input"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="claim-email">
                Email <span className="required">*</span>
              </label>
              <input
                id="claim-email"
                className="input"
                type="email"
                value={values.email}
                onChange={(e) => setValues({ ...values, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="claim-phone">Phone</label>
              <input
                id="claim-phone"
                className="input"
                value={values.phone}
                onChange={(e) => setValues({ ...values, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="claim-description">
              Describe Your Claim <span className="required">*</span>
            </label>
            <textarea
              id="claim-description"
              className="input"
              value={values.description}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
            />
          </div>

          {error && <p role="alert" className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

          <div className="row">
            <button type="button" className="btn" onClick={onBack}>
              ← Back
            </button>
            <button type="submit" className="btn btn-primary">
              Continue to Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
