import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPage from '@/components/site/PublicPage'
import { Container, Eyebrow, H2, Lede, RunLog, Section } from '@/components/ui'
import { FIRM } from '@/lib/sitePractices'
import styles from '@/components/site/pages.module.css'

// For lenders and other businesses: borrowers in bulk through a shared Google Sheet or the
// borrower API. Facts from CLAUDE.md ("Brand sheets" phases 1–5C): one case per loan, a lawyer-
// approved letter served by email, Day 7 and Day 14 reminders, change flags, court only with the
// brand's written approval, monthly invoices, signed webhooks, and a test mode.

export const metadata: Metadata = {
  title: 'For businesses',
  description: 'Loan recovery for lenders: send borrowers by Google Sheet or API, and Pandas LP drafts, lawyer-approves and serves each demand letter, with Day 7 and Day 14 reminders.',
  alternates: { canonical: '/businesses' },
}

export const revalidate = 60

const STEPS = [
  { t: 'You send borrowers', b: 'One row per borrower in a shared Google Sheet, or by API. Each loan becomes one case, never two.' },
  { t: 'We check and draft', b: 'Missing details or documents come back to you as a clear list. Complete borrowers get a drafted letter of demand.' },
  { t: 'A lawyer approves', b: 'Every letter is reviewed and approved by a licensed practitioner before it goes out.' },
  { t: 'We serve and remind', b: 'The letter is served by email with your team in copy, then Day 7 and Day 14 reminders, within working hours.' },
  { t: 'You decide on court', b: 'If a borrower still has not paid after Day 14, nothing goes to court without your written approval.' },
  { t: 'One invoice a month', b: 'Billed per lawyer-approved letter, at the fee agreed with you, on one invoice each month.' },
]

const API = [
  { t: 'Never twice', b: 'Your loan ID is unique per key. Resending a loan returns the same case.' },
  { t: 'Signed webhooks', b: 'Letter drafted, lawyer approved, served, Day 7, Day 14, outcome: each step is sent to your address, signed, and retried for a day.' },
  { t: 'A test mode first', b: 'Test keys walk a pretend borrower through every step, with no AI, no lawyer and no email, before any real borrower.' },
  { t: 'Changes are flagged, not lost', b: 'Edits after a letter is drafted are flagged for our staff to decide, never silently applied.' },
]

export default function BusinessesPage() {
  return (
    <PublicPage>
      <section className={styles.hero} aria-label="For businesses">
        <Container>
          <div className={styles.split} style={{ alignItems: 'center' }}>
            <div>
              <Eyebrow>For lenders and businesses</Eyebrow>
              <h1 className={styles.h1}>Send borrowers in bulk. We do the rest.</h1>
              <p className={styles.lede}>
                A shared Google Sheet or an API. Each borrower gets a letter of demand drafted from the firm’s template,
                approved by a licensed practitioner, served by email and followed up on Day 7 and Day 14.
              </p>
              <div className={styles.actions}>
                <a className="btn btn-primary btn-lg" href={`mailto:${FIRM.email}?subject=${encodeURIComponent('Loan recovery for our business')}`}>Talk to us</a>
                <Link className="btn btn-outline btn-lg" href="/developers/api">Read the API docs</Link>
              </div>
            </div>
            <RunLog
              title="ACME-0042 · borrower · via API"
              steps={[
                { status: 'done', text: 'Borrower received', detail: 'LN-2026-0042' },
                { status: 'done', text: 'Details and documents checked' },
                { status: 'done', text: 'Letter of demand drafted' },
                { status: 'done', text: 'Approved by a lawyer' },
                { status: 'done', text: 'Served by email, your team in copy' },
                { status: 'next', text: 'Day 7 reminder due' },
              ]}
            />
          </div>
        </Container>
      </section>

      <Section label="How it runs">
        <Eyebrow>How it runs</Eyebrow>
        <H2>Six steps, the same for every borrower.</H2>
        <ol className={styles.steps} style={{ marginTop: 40 }}>
          {STEPS.map((s) => (
            <li key={s.t}><h3>{s.t}</h3><p>{s.b}</p></li>
          ))}
        </ol>
      </Section>

      <Section tone="muted" label="The API">
        <div className={styles.split}>
          <div>
            <Eyebrow>The borrower API</Eyebrow>
            <H2>Built for systems that send thousands.</H2>
            <Lede>Up to 50 borrowers a request, 60 requests a minute per key, every call logged.</Lede>
            <p style={{ marginTop: 24 }}><Link href="/developers/api" className={styles.textLink}>Read the API docs</Link></p>
          </div>
          <ul className={styles.rows}>
            {API.map((s, i) => (
              <li key={s.t}><span>{String(i + 1).padStart(2, '0')}</span><span><strong>{s.t}</strong><p>{s.b}</p></span></li>
            ))}
          </ul>
        </div>
      </Section>
    </PublicPage>
  )
}
