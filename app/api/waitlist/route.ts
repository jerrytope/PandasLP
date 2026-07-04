export const runtime = 'nodejs'

import { isMailerConfigured, sendMail, GMAIL_USER } from '@/lib/mailer'

export async function POST(req: Request) {
  if (!isMailerConfigured()) {
    return Response.json({ error: 'Email not configured.' }, { status: 503 })
  }

  let body: { service: string; email: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { service, email } = body
  if (!email || !service) {
    return Response.json({ error: 'Missing fields.' }, { status: 400 })
  }

  try {
    await sendMail({
      to: GMAIL_USER,
      replyTo: email,
      subject: `Waitlist signup — ${service}`,
      text: `${email} signed up to be notified when ${service} goes live on Pandas LP.`,
      html: `
        <p><strong>${email}</strong> signed up to be notified when <strong>${service}</strong> goes live on Pandas LP.</p>
        <p style="color:#8A9B8F;font-size:13px;">Sent from the Pandas LP waitlist form.</p>
      `,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 502 })
  }

  return Response.json({ ok: true })
}
