import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPage from '@/components/site/PublicPage'
import { Container, Eyebrow, H2, Lede, Pipeline, RunLog, Section, SitePhoto } from '@/components/ui'
import { FIRM } from '@/lib/sitePractices'
import styles from '@/components/site/pages.module.css'

// How the firm works: the review process, confidentiality and the firm's credentials, each
// stated exactly as it is. Facts from lib/agentPagesData.js, the privacy policy and CLAUDE.md
// (CAC Business Name BN 9646741; the NBA has been notified).

export const metadata: Metadata = {
  title: 'How we work',
  description: 'How a Pandas LP matter moves from your answers to a signed document: what the agent does, what the lawyer checks, and how your information is kept.',
  alternates: { canonical: '/how-we-work' },
}

export const revalidate = 60

const PIPELINE = [
  { title: 'Interview', ai: 'Asks plain questions in your own words and saves each fact.', lawyer: 'Steps in when a matter is contested or unclear.' },
  { title: 'Draft', ai: 'Fills the firm’s own template. Never a blank page.', lawyer: 'Wrote the templates and the rules the agent follows.' },
  { title: 'You read it', ai: 'Shows you the whole draft before you pay.', lawyer: 'Nothing has gone anywhere yet.' },
  { title: 'Review and sign', ai: 'Waits.', lawyer: 'Reads, corrects and signs every document.' },
  { title: 'Serve and follow up', ai: 'Sends the Day 7 and Day 14 follow-ups.', lawyer: 'Serves it if you ask, and files at court if it comes to that.' },
]

const STOPS = [
  { t: 'Above the Small Claims limit', b: 'A claim above the court’s limit, a counterclaim, disputed liability or any hint of fraud goes to a practitioner instead of the agent.' },
  { t: 'Contested property matters', b: 'Live litigation, disputed ownership, squatters, or skipping Governor’s Consent go to a practitioner before any drafting.' },
  { t: 'Anything it is not certain of', b: 'No case references, statute sections or figures it cannot confirm. It asks you instead of guessing.' },
  { t: 'Anything outside its documents', b: 'A document it was not built for is escalated to a lawyer, not freehanded.' },
]

const SAFEGUARDS = [
  { t: 'Only the people working on your matter see it', b: 'Access to case data is restricted to you and to the Pandas LP staff who need it to work on your matter.' },
  { t: 'Encrypted, and held with named providers', b: 'Your case is stored with Supabase, our database provider, encrypted at rest. The facts of your case go to Anthropic, our AI provider, only to draft your document; it does not keep them to train its models.' },
  { t: 'Not sold. Not used to train AI', b: 'We do not sell your data, and it is not used to train any AI model beyond the single request needed to draft your document.' },
  { t: 'We never see your card', b: 'Payments are processed by Paystack. We receive confirmation and the amount, never your card or bank details.' },
  { t: 'Your rights under the NDPA 2023', b: 'You can ask to see, correct or delete the personal data we hold about you.' },
]

export default function HowWeWorkPage() {
  return (
    <PublicPage>
      {(content) => (
        <>
          <section className={styles.hero} aria-label="How we work">
            <Container>
              <div className={styles.split} style={{ alignItems: 'center' }}>
                <div>
                  <Eyebrow>How we work</Eyebrow>
                  <h1 className={styles.h1}>The agent drafts. A lawyer signs.</h1>
                  <p className={styles.lede}>
                    Every matter runs the same way. The agent does the careful, repetitive part. A licensed practitioner does
                    the part that needs judgment, and nothing reaches anyone until they have.
                  </p>
                </div>
                <RunLog
                  title="matter PLP-0207 · Notice to quit · Lagos"
                  steps={[
                    { status: 'done', text: 'Tenancy type confirmed', detail: 'Yearly' },
                    { status: 'done', text: 'Notice period worked out', detail: '6 months' },
                    { status: 'done', text: 'Notice to quit drafted' },
                    { status: 'done', text: 'Client read the draft and paid', detail: '₦25,000' },
                    { status: 'next', text: 'Awaiting review and signature by a lawyer' },
                  ]}
                />
              </div>
            </Container>
          </section>

          <Section label="The steps">
            <Eyebrow>The steps</Eyebrow>
            <H2>Five steps, and one of them is always a person.</H2>
            <div style={{ marginTop: 48 }}><Pipeline steps={PIPELINE} /></div>
          </Section>

          <Section tone="band" label="The lawyer" flush>
            <SitePhoto photo={content.photos.lawyerReview} label="A lawyer reviewing a draft" ratio="21 / 9" />
          </Section>

          <Section label="Where the agent stops">
            <div className={styles.split}>
              <div>
                <Eyebrow>Where the agent stops</Eyebrow>
                <H2>It knows what it should not do.</H2>
                <Lede>These go to a practitioner before anything is drafted. The full list for each practice is published on its page.</Lede>
                <p style={{ marginTop: 24 }}>
                  <Link href="/agents/debt-recovery/limits" className={styles.textLink}>Debt recovery limits</Link>
                  <span style={{ margin: '0 12px', color: 'var(--text-3)' }}>·</span>
                  <Link href="/agents/property-law/limits" className={styles.textLink}>Property law limits</Link>
                </p>
              </div>
              <ul className={styles.rows}>
                {STOPS.map((s, i) => (
                  <li key={s.t}><span>{String(i + 1).padStart(2, '0')}</span><span><strong>{s.t}</strong><p>{s.b}</p></span></li>
                ))}
              </ul>
            </div>
          </Section>

          <Section tone="muted" id="confidentiality" label="Confidentiality">
            <div className={styles.split}>
              <div>
                <Eyebrow>Confidentiality</Eyebrow>
                <H2>What you tell us stays with the firm.</H2>
                <Lede>Taken from our privacy policy, which says it in full.</Lede>
                <p style={{ marginTop: 24 }}><Link href="/privacy" className={styles.textLink}>Read the privacy policy</Link></p>
              </div>
              <ul className={styles.rows}>
                {SAFEGUARDS.map((s, i) => (
                  <li key={s.t}><span>{String(i + 1).padStart(2, '0')}</span><span><strong>{s.t}</strong><p>{s.b}</p></span></li>
                ))}
              </ul>
            </div>
          </Section>

          <Section id="credentials" label="Credentials">
            <Eyebrow>Who we are</Eyebrow>
            <H2>Stated exactly.</H2>
            <div className={styles.facts} style={{ marginTop: 40 }}>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Registration</span>
                <span className={styles.factValue}>{FIRM.registration}</span>
                <span className={styles.factNote}>Registered with the Corporate Affairs Commission as a business name. Not a limited company.</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Bar</span>
                <span className={styles.factValue}>NBA notified</span>
                <span className={styles.factNote}>The Nigerian Bar Association has been notified of the firm.</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Who signs</span>
                <span className={styles.factValue}>A licensed practitioner</span>
                <span className={styles.factNote}>Every document is reviewed and signed by one before it is served or filed.</span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Office</span>
                <span className={styles.factValue}>Victoria Island, Lagos</span>
                <span className={styles.factNote}>{FIRM.address.join(', ')}. {FIRM.phone}.</span>
              </div>
            </div>
          </Section>
        </>
      )}
    </PublicPage>
  )
}
