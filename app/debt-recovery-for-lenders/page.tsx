import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPage from '@/components/site/PublicPage'
import { Container, Eyebrow, H2, Lede, Section } from '@/components/ui'
import { FIRM } from '@/lib/sitePractices'
import styles from '@/components/site/pages.module.css'

const TITLE = 'Loan Recovery for Lenders and Businesses'
const DESCRIPTION = 'A lawyer-led process for lenders managing overdue accounts, with reviewed demand letters, follow-ups and reporting agreed for each portfolio.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/debt-recovery-for-lenders' },
  openGraph: { type: 'website', title: `${TITLE} | Pandas LP`, description: DESCRIPTION, url: '/debt-recovery-for-lenders' },
}

const STEPS = [
  { title: 'Agree a pilot', body: 'The firm and lender agree the account types, scope, fees, reporting and approval points before any files are accepted.' },
  { title: 'Share the records securely', body: 'Provide only the borrower and loan information needed for the agreed work, including the loan terms, account statement, repayment history and prior notices.' },
  { title: 'Review every file', body: 'Missing information is flagged. A lawyer reviews and signs each demand letter before service; no court step is taken without written approval.' },
  { title: 'Track and report', body: 'The parties agree how service, replies, payments, disputes and next steps will be recorded and reported during the pilot.' },
]

export default function DebtRecoveryForLendersPage() {
  return (
    <PublicPage>
      <section className={styles.hero} aria-label="Loan recovery for lenders">
        <Container>
          <div className={styles.split}>
            <div>
              <Eyebrow>For lenders with overdue accounts</Eyebrow>
              <h1 className={styles.h1}>A lawyer-led process for loan recovery.</h1>
              <p className={styles.lede}>
                Start with a defined pilot. Agree what files are in scope, what records are needed, the fees and the
                reporting before any borrower is contacted.
              </p>
              <div className={styles.actions}>
                <a className="btn btn-primary btn-lg" href={`mailto:${FIRM.email}?subject=${encodeURIComponent('Lender debt recovery pilot')}`}>Discuss a pilot</a>
                <Link className="btn btn-outline btn-lg" href="/businesses">Explore the borrower API</Link>
              </div>
            </div>
            <div>
              <Eyebrow>Accountability at every stage</Eyebrow>
              <p className={styles.lede}>Every letter is reviewed by a practitioner. Court filing and other material next steps require the lender’s written approval.</p>
            </div>
          </div>
        </Container>
      </section>

      <Section label="Lender recovery process">
        <Eyebrow>How it works</Eyebrow>
        <H2>Start with a small, agreed scope.</H2>
        <ol className={styles.steps} style={{ marginTop: 32 }}>
          {STEPS.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="muted" label="Lender recovery fees">
        <Eyebrow>Pricing and approval</Eyebrow>
        <H2>Fees and reporting are agreed before the pilot.</H2>
        <p className={styles.lede}>
          The standard demand-letter options are ₦20,000 when the lender serves the reviewed letter and ₦40,000 when
          Pandas LP serves it. Portfolio pricing, reporting and any further court work are agreed in writing for the
          particular engagement; court fees are separate.
        </p>
        <p className={styles.lede} style={{ marginTop: 24 }}>
          For single business debts, see <Link href="/debt-recovery-for-businesses" className={styles.textLink}>business debt recovery</Link>.
        </p>
      </Section>
    </PublicPage>
  )
}
