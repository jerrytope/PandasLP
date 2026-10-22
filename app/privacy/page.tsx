import Link from 'next/link'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const TITLE = 'Privacy Policy'
const DESCRIPTION = 'How Pandas LP collects, uses, and protects your personal data under the Nigeria Data Protection Act 2023.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
}

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />

      <main className="container" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <article style={{ maxWidth: 680, margin: '0 auto' }}>
          <span className="label-mono">Legal</span>
          <h1 style={{
            margin: '8px 0 12px',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.5vw,44px)',
            fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.12,
          }}>
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 40 }}>
            Last updated: 27 September 2026
          </p>

          <div className="blog-content">
            <p>Pandas LP ("we," "us," "our") is a CAC-registered law firm (Business Name BN 9646741) based in Lagos, Nigeria. This policy explains what personal data we collect when you use pandaslp.com.ng, why we collect it, and the rights you have over it under the Nigeria Data Protection Act 2023 ("NDPA").</p>

            <h2>1. What We Collect</h2>
            <p>When you use our site or start a case, we collect:</p>
            <ul>
              <li><strong>Account information</strong>: your email address (used for magic-link sign-in, no password stored)</li>
              <li><strong>Case details</strong>: whatever you tell our AI agent during the guided interview: names, amounts owed, dates, descriptions of the dispute, and any documents you upload (invoices, contracts, screenshots)</li>
              <li><strong>Contact information</strong>: a callback phone number, if you provide one for a lawyer to reach you</li>
              <li><strong>Free debt check answers</strong>: if you use our debt check and ask a lawyer to contact you, your answers (who owes you, how much, what proof you have), your name, phone number and, optionally, email</li>
              <li><strong>Consent records</strong>: when you agree to be contacted or to receive tips and news, we record what you agreed to, the exact wording you saw, when, and on which page, so we can show your choice was yours</li>
              <li><strong>Payment information</strong>: processed directly by Paystack; we receive confirmation of payment and the amount, never your card or bank details</li>
              <li><strong>Usage data</strong>: basic analytics (pages visited, which channel brought you to the site) via Google Analytics</li>
            </ul>

            <h2>2. Why We Collect It</h2>
            <p>We use your data to:</p>
            <ul>
              <li>Draft the legal document you've requested (a Letter of Demand, court filing, contract, etc.)</li>
              <li>Have a licensed lawyer on our team review that document before it's served or filed</li>
              <li>Serve or file documents on your behalf, where you've asked us to</li>
              <li>Contact you about the progress of your case</li>
              <li>Verify payment and issue confirmations</li>
              <li>Send you legal tips and news, <strong>only</strong> if you have separately ticked a box or subscribed to receive them</li>
              <li>Improve the site and understand which channels reach the people who need us</li>
            </ul>
            <p>We do not sell your data, and we do not use it to train any third-party AI model beyond the single request needed to draft your document.</p>

            <h3>Marketing messages</h3>
            <p>We only send tips and news to people who have asked for them. Agreeing to be contacted about your debt or case does not sign you up. You can stop marketing messages at any time: use the unsubscribe link in any email, reply STOP on WhatsApp, or email us. Stopping marketing never affects messages about a case you have with us.</p>

            <h2>3. Who We Share It With</h2>
            <p>We share data only where necessary to provide the service:</p>
            <ul>
              <li><strong>Anthropic</strong> (our AI provider): receives the facts of your case to draft your document. Anthropic does not retain this to train its models.</li>
              <li><strong>Paystack</strong>: processes your payment. We never see or store your card details.</li>
              <li><strong>Supabase</strong>: our database and authentication provider, hosting your case data securely.</li>
              <li>The person you're pursuing a claim against, only to the extent your document itself is served on them, which is the whole point of the service.</li>
            </ul>
            <p>We do not share your data with any other third party, and we do not sell it.</p>

            <h2>4. How Long We Keep It</h2>
            <p>We retain your case data for as long as your matter could reasonably still be relevant, including any period during which a debt or judgment remains legally enforceable, and in any event no longer than necessary to comply with our own professional and regulatory obligations as a law firm. You can request deletion earlier; see Section 6.</p>
            <p>We keep a record of each consent, and of any withdrawal, for as long as we rely on it and for a reasonable period afterwards, so we can show what you chose and when. If you unsubscribe, we keep a note of that so we don’t message you again.</p>

            <h2>5. Security</h2>
            <p>Your data is encrypted in transit (HTTPS) and at rest by our database provider. Access to case data is restricted to you, and to Pandas LP staff who need it to work on your matter. Payment is never handled directly by us.</p>

            <h2>6. Your Rights Under the NDPA</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access</strong> the personal data we hold about you</li>
              <li><strong>Correct</strong> inaccurate data</li>
              <li><strong>Request deletion</strong> of your data, subject to our legal and professional retention obligations</li>
              <li><strong>Object</strong> to certain uses of your data</li>
              <li><strong>Withdraw consent</strong> where our use of your data relies on it</li>
            </ul>
            <p>To exercise any of these rights, email <a href="mailto:pandaslegalpractitioners@gmail.com">pandaslegalpractitioners@gmail.com</a> with your request. We'll respond within a reasonable time and in line with NDPA requirements.</p>

            <h2>7. Cookies & Analytics</h2>
            <p>We use Google Analytics to understand site usage. This does not identify you personally. We do not use tracking cookies for advertising.</p>

            <h2>8. Changes to This Policy</h2>
            <p>We may update this policy as our practice evolves. Material changes will be reflected here with an updated "last updated" date.</p>

            <h2>9. Contact</h2>
            <p>Questions about this policy or your data can be sent to <a href="mailto:pandaslegalpractitioners@gmail.com">pandaslegalpractitioners@gmail.com</a>.</p>
          </div>
        </article>
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  )
}
