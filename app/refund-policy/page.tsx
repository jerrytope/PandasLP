import Link from 'next/link'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'

const TITLE = 'Refund Policy'
const DESCRIPTION = 'When Pandas LP issues refunds, and how to request one.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/refund-policy' },
  robots: { index: true, follow: true },
}

export default function RefundPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <header className="navbar" role="banner">
        <div className="container navbar-inner">
          <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
            Pandas <span className="accent">LP</span>
          </Link>
          <Link href="/" className="btn btn-ghost" style={{ fontSize: 14 }}>← Home</Link>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 64, paddingBottom: 96 }}>
        <article style={{ maxWidth: 680, margin: '0 auto' }}>
          <span className="label-mono">Legal</span>
          <h1 style={{
            margin: '8px 0 12px',
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,4.5vw,44px)',
            fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.12,
          }}>
            Refund Policy
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 40 }}>
            Last updated: 27 July 2026
          </p>

          <div className="blog-content">
            <p>Pandas LP charges a fee to draft your legal document, and, where you've chosen it, to serve or file it on your behalf. This page explains when a refund applies.</p>

            <h2>1. Document Drafting Fee</h2>
            <p>Once your document has been drafted and made available to you, the drafting fee is <strong>non-refundable</strong>. This reflects the work already completed: your case has been reviewed, the document written, and a member of our legal team has checked it before release to you.</p>
            <p>This is the same principle any law firm operates on: you're paying for the work of preparing your document, not for a particular outcome once it's served or filed.</p>

            <h2>2. When a Refund Does Apply</h2>
            <p>We will refund you in full if:</p>
            <ul>
              <li>You were charged twice for the same case (duplicate payment)</li>
              <li>Payment was taken but no document was ever generated, due to a technical failure on our side</li>
              <li>You paid for Pandas LP to serve your letter (the ₦25,000 tier), and we failed to serve it within a reasonable time through our own fault</li>
            </ul>
            <p>We will assess partial refunds on a case-by-case basis for the pandas-serves tier if service was attempted but not completed, at our discretion, based on the work actually performed.</p>

            <h2>3. What's Never Refundable</h2>
            <ul>
              <li>The drafting fee, once your document has been delivered to you, regardless of what happens after (the debtor doesn't respond, the case doesn't proceed, you decide not to pursue it further)</li>
              <li>Court filing fees paid directly to the court registry: these are set and collected by the court, not by us, and are non-refundable by the court itself once filed</li>
            </ul>

            <h2>4. How to Request a Refund</h2>
            <p>Email <a href="mailto:pandaslegalpractitioners@gmail.com">pandaslegalpractitioners@gmail.com</a> with your case reference number and the reason for your request. We aim to respond within 2 business days. Approved refunds are returned to your original payment method via Paystack within 5-10 business days.</p>

            <h2>5. Disputes</h2>
            <p>If you believe you were charged in error and we haven't resolved it to your satisfaction, you're entitled to raise the matter with your bank or with Paystack directly, in addition to contacting us.</p>
          </div>
        </article>
      </main>
      <WhatsAppFab />
    </div>
  )
}
