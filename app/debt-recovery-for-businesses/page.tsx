import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPage from '@/components/site/PublicPage'
import { Container, Eyebrow, H2, Lede, Section } from '@/components/ui'
import { FIRM } from '@/lib/sitePractices'
import styles from '@/components/site/pages.module.css'

const TITLE = 'Debt Recovery for Businesses in Nigeria'
const DESCRIPTION = 'Recover unpaid business invoices with a lawyer-reviewed demand letter from ₦20,000, follow-ups, and a clear next step if the customer does not pay.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/debt-recovery-for-businesses' },
  openGraph: { type: 'website', title: `${TITLE} | Pandas LP`, description: DESCRIPTION, url: '/debt-recovery-for-businesses' },
}

const STEPS = [
  { title: 'Share the facts', body: 'Tell us who owes the business, what is owed, when payment was due, and what was agreed. Upload invoices, contracts, receipts or messages that support the claim.' },
  { title: 'A lawyer checks the draft', body: 'The agent prepares a draft from the information provided. A Pandas LP practitioner reviews and signs the letter before it is served.' },
  { title: 'Serve and follow up', body: 'Choose self-service or ask Pandas LP to serve the letter. Follow-up notices are scheduled for Days 7, 10, 14 and 15, using the recorded receipt date where available.' },
  { title: 'Agree the next step', body: 'If payment is not made, a lawyer can discuss options. Lagos and Delta court documents are prepared only where an approved template exists, and nothing is filed without the client’s approval and signed forms.' },
]

export default function DebtRecoveryForBusinessesPage() {
  return (
    <PublicPage>
      <section className={styles.hero} aria-label="Debt recovery for businesses">
        <Container>
          <div className={styles.split}>
            <div>
              <Eyebrow>For businesses owed money</Eyebrow>
              <h1 className={styles.h1}>Get paid for work you have already done.</h1>
              <p className={styles.lede}>
                A lawyer-reviewed Letter of Demand starts at <strong>₦20,000</strong>. Pandas LP can also serve it for
                <strong> ₦40,000</strong>, then follow up with the customer on the approved schedule.
              </p>
              <div className={styles.actions}>
                <Link className="btn btn-primary btn-lg" href="/agent/small-claims">Start a recovery</Link>
                <a className="btn btn-outline btn-lg" href={`mailto:${FIRM.email}?subject=${encodeURIComponent('Business debt recovery')}`}>Talk to the firm</a>
              </div>
            </div>
            <div>
              <Eyebrow>Clear process, no promised outcome</Eyebrow>
              <p className={styles.lede}>Each claim depends on its evidence, the debtor’s response and the law that applies. No recovery can be guaranteed.</p>
            </div>
          </div>
        </Container>
      </section>

      <Section label="How business debt recovery works">
        <Eyebrow>How it works</Eyebrow>
        <H2>One documented step at a time.</H2>
        <ol className={styles.steps} style={{ marginTop: 32 }}>
          {STEPS.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="muted" label="Business debt recovery fees">
        <Eyebrow>Fees</Eyebrow>
        <H2>Know the fee before you proceed.</H2>
        <ul className={styles.rows}>
          <li><span>01</span><span><strong>Self-service demand letter · ₦20,000</strong><p>Drafted for lawyer review and signing; your business serves it.</p></span></li>
          <li><span>02</span><span><strong>Pandas LP serves · ₦40,000</strong><p>Drafted, reviewed, signed and served by the firm.</p></span></li>
          <li><span>03</span><span><strong>Possible court filing · quoted separately</strong><p>Eligibility, court fees and any further legal work are confirmed with you first.</p></span></li>
        </ul>
        <p className={styles.lede} style={{ marginTop: 24 }}>
          Have many accounts? See our <Link href="/debt-recovery-for-lenders" className={styles.textLink}>lender portfolio service</Link> or the <Link href="/businesses" className={styles.textLink}>borrower API</Link>.
        </p>
      </Section>
    </PublicPage>
  )
}
