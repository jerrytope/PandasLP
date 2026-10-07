import nodemailer from 'nodemailer'

export const GMAIL_USER = 'pandaslegalpractitioners@gmail.com'

export function isMailerConfigured() {
  const pass = process.env.GMAIL_APP_PASSWORD
  return Boolean(pass) && pass !== 'REPLACE_WITH_GOOGLE_APP_PASSWORD'
}

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export interface SendMailOptions {
  to: string
  /** Copied in, visible to the recipient (e.g. the brand on a borrower's reminder). */
  cc?: string | string[]
  replyTo?: string
  subject: string
  text: string
  html: string
  attachments?: { filename: string; content: Buffer; contentType?: string }[]
}

export async function sendMail(options: SendMailOptions) {
  return getTransporter().sendMail({
    from: `Pandas LP <${GMAIL_USER}>`,
    ...options,
  })
}
