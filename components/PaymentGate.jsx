import PaymentForm from './PaymentForm'

export default function PaymentGate({ amount, description, onSuccess, onBack }) {
  return (
    <div className="step-page">
      <div className="container">
        <div className="step-header">
          <span className="label-mono">Payment</span>
          <h2>Payment</h2>
        </div>

        <PaymentForm amount={amount} description={description} onSuccess={onSuccess} onBack={onBack} />
      </div>
    </div>
  )
}
