'use client'

import { useState } from 'react'

export default function EnforcementIntake({ parentCase, onSubmit, onBack }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!amount || Number.isNaN(value) || value <= 0) {
      setError('Please enter the judgment amount the court awarded.')
      return
    }
    setError('')
    onSubmit(value)
  }

  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">Judgment Enforcement</span>
          <h2>Let's enforce your judgment</h2>
          <p>
            This continues your case{parentCase?.document_title ? ` for "${parentCase.document_title}"` : ''} —
            we'll link it to the original matter so our team has the full history.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 480 }}>
          <div className="form-group">
            <label htmlFor="enforcement-amount">
              Judgment Amount Awarded by the Court (₦) <span className="required">*</span>
            </label>
            <input
              id="enforcement-amount"
              className="input"
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {error && <p role="alert" className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

          <div className="row">
            <button type="button" className="btn" onClick={onBack}>
              ← Back
            </button>
            <button type="submit" className="btn btn-primary">
              Continue →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
