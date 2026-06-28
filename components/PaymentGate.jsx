'use client'

import { useState } from 'react'
import { isPaystackStubbed, payWithPaystack, generateReference } from '@/lib/paystackHelper'

export default function PaymentGate({ amount, description, onSuccess, onBack }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleRealPayment() {
    if (!email) {
      setError('Enter your email to continue')
      return
    }
    setLoading(true)
    setError('')
    payWithPaystack({
      email,
      amountNaira: amount,
      reference: generateReference(),
      onSuccess: (response) => {
        setLoading(false)
        onSuccess(response)
      },
      onClose: () => setLoading(false),
    }).catch((err) => {
      setLoading(false)
      setError(err.message)
    })
  }

  function handleStubPayment() {
    if (!email) {
      setError('Enter your email to continue')
      return
    }
    setLoading(true)
    setError('')
    setTimeout(() => {
      setLoading(false)
      onSuccess({ reference: generateReference(), status: 'success', stub: true })
    }, 900)
  }

  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">Step 3 of 4</span>
          <h2>Payment</h2>
          <p>{description}</p>
        </div>

        <div className="card" style={{ maxWidth: 480 }}>
          {isPaystackStubbed && <span className="badge badge-test">Test Mode — No Real Charge</span>}

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Email Address</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="row" style={{ justifyContent: 'space-between', margin: '16px 0' }}>
            <span className="label-mono">Amount Due</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20 }}>
              ₦{amount.toLocaleString()}
            </span>
          </div>

          {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}

          <div className="row">
            <button type="button" className="btn" onClick={onBack} disabled={loading}>
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={isPaystackStubbed ? handleStubPayment : handleRealPayment}
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : `Pay ₦${amount.toLocaleString()} with Paystack`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
