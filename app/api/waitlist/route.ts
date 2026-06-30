export const runtime = 'nodejs'

import nodemailer from 'nodemailer'

const GMAIL_USER = 'pandaslegalpractitioners@gmail.com'

export async function POST(req: Request) {
  const appPassword = process.env.GMAIL_APP_PASSWORD
  if (!appPassword || appPassword === 'REPLACE_WITH_GOOGLE_APP_PASSWORD') {
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

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: appPassword },
  })

  await transporter.sendMail({
    from: `Pandas LP <${GMAIL_USER}>`,
    to: GMAIL_USER,
    subject: `Waitlist signup — ${service}`,
    html: `
      <p><strong>${email}</strong> signed up to be notified when <strong>${service}</strong> goes live on Pandas LP.</p>
      <p style="color:#8A9B8F;font-size:13px;">Sent from the Pandas LP waitlist form.</p>
    `,
  })

  return Response.json({ ok: true })
}
