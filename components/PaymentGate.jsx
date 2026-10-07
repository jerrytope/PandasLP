import PaymentForm from './PaymentForm'

export default function PaymentGate({ amount, description, onSuccess, onBack, busy = false, error = '' }) {
  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">Payment</span>
          <h2>Payment</h2>
        </div>

        <PaymentForm amount={amount} description={description} onSuccess={onSuccess} onBack={onBack} busy={busy} />
        {busy && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 10 }}>Confirming your payment…</p>
        )}
        {error && (
          <p role="alert" className="error-text" style={{ marginTop: 10, maxWidth: 480 }}>{error}</p>
        )}
      </div>
    </div>
  )
}
