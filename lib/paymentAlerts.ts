import { GMAIL_USER, isMailerConfigured, sendMail } from './mailer'

export async function sendPaymentProblemAlert(input: {
  caseId: string | null
  reference: string | null
  amount: number | null
  reason: string
  clientEmail: string | null
}) {
  console.error(`[payment problem] case=${input.caseId ?? '-'} ref=${input.reference ?? '-'} reason=${input.reason}`)
  if (!isMailerConfigured()) return
  const text = [
    'A Paystack payment could not be applied automatically.',
    `Case: ${input.caseId ?? 'unknown'}`,
    `Reference: ${input.reference ?? 'unknown'}`,
    `Amount: ${input.amount == null ? 'unknown' : `₦${input.amount.toLocaleString('en-NG')}`}`,
    `Client: ${input.clientEmail ?? 'unknown'}`,
    `Reason: ${input.reason}`,
  ].join('\n')
  try {
    await sendMail({
      to: GMAIL_USER,
      subject: `Payment needs attention${input.caseId ? ` (${input.caseId.slice(0, 8)})` : ''}`,
      text,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
    })
  } catch (error) {
    console.error('Failed to send payment problem alert:', error)
  }
}
