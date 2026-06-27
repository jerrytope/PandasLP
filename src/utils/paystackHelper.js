const PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ''

export const isPaystackStubbed = !PUBLIC_KEY || PUBLIC_KEY.includes('placeholder')

let scriptPromise = null

function loadPaystackScript() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = resolve
    script.onerror = reject
    document.body.appendChild(script)
  })
  return scriptPromise
}

export async function payWithPaystack({ email, amountNaira, reference, onSuccess, onClose }) {
  if (isPaystackStubbed) {
    throw new Error('Paystack is not configured. Use the test-mode checkout instead.')
  }
  await loadPaystackScript()
  const handler = window.PaystackPop.setup({
    key: PUBLIC_KEY,
    email,
    amount: Math.round(amountNaira * 100),
    ref: reference,
    currency: 'NGN',
    onClose,
    callback: (response) => onSuccess(response),
  })
  handler.openIframe()
}

export function generateReference(prefix = 'pandaslp') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
