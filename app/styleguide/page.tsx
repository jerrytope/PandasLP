import type { Metadata } from 'next'
import ThemeToggle from '@/components/ThemeToggle'
import {
  AnnouncementBar,
  Carousel,
  Container,
  DocumentPreview,
  Eyebrow,
  H2,
  Lede,
  Pipeline,
  QuoteCard,
  RunLog,
  Section,
  SitePhoto,
  StatRow,
  Tag,
} from '@/components/ui'
import { getSiteContent } from '@/lib/siteContent'
import { PHOTO_SLOTS, PHOTO_SLOT_LABELS } from '@/lib/siteContentSchema'

// The "Ink & Brass" building blocks in one place, to review in both themes before they are
// used on real pages (docs/frontend-revamp-plan.md). Not linked from the site; noindex.
// The numbers and the quote below are SAMPLES for this page only: the real site shows only
// what staff publish in Admin → Site content.

export const metadata: Metadata = {
  title: 'Style guide',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const SWATCHES = ['--bg-0', '--bg-1', '--bg-2', '--text-1', '--text-body', '--text-2', '--text-3', '--accent', '--success', '--danger']

const PRACTICES = [
  { ref: 'PLP · SMALL CLAIMS', title: 'Letter of demand', price: 'from ₦10,000', body: ['Our client, Ade Logistics Limited, instructs us that you owe the sum of ₦2,400,000 being the balance due on invoice PLP-0042 dated 3 August 2026.', 'TAKE NOTICE that unless the said sum is paid within fourteen (14) days of the receipt of this letter, we have firm instructions to commence proceedings against you without further notice.'] },
  { ref: 'PLP · PROPERTY', title: 'Notice to quit', price: '₦25,000', body: ['TAKE NOTICE that our Client hereby gives you notice to QUIT AND DELIVER UP vacant possession of the premises situate at No. 4 Isokan Street, which you hold as our Client’s yearly tenant.', 'on or before 31 December 2027, being the expiration of six (6) months from the date this notice is served on you.'] },
  { ref: 'PLP · CONTRACTS', title: 'Service agreement', price: '₦5,000', body: ['THIS AGREEMENT is made this … day of … 2026 BETWEEN the Client of the one part and the Service Provider of the other part.', '1. SERVICES. The Service Provider shall provide the services set out in Schedule 1 with reasonable skill and care.'] },
  { ref: 'PLP · CAC', title: 'Business name registration', price: '₦15,000', body: ['Proposed name: … (with two alternatives, in order of preference).', 'Nature of business, principal place of business, and the particulars of each proprietor, as required by the Companies and Allied Matters Act 2020.'] },
]

export default async function StyleguidePage() {
  const content = await getSiteContent()
  return (
    <main>
      <AnnouncementBar label="New" text="The Property Law Agent now covers 12 states" href="/property-law" />

      <Section flush label="Style guide intro">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Eyebrow>Style guide · Ink &amp; Brass</Eyebrow>
          <ThemeToggle />
        </div>
        <h1 style={{ fontSize: 'var(--fs-display)', maxWidth: '14ch', margin: '8px 0 24px' }}>Legal work, drafted by AI. Signed by a lawyer.</h1>
        <Lede>Every block the new site is built from, in one place. Switch the theme to check both. The numbers and the quote on this page are samples; the live site shows only what is published in Admin → Site content.</Lede>
        <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
          <a className="btn btn-primary btn-lg" href="#">Start a matter</a>
          <a className="btn btn-outline btn-lg" href="#">Talk to a lawyer</a>
          <a className="btn btn-ghost" href="#">Read more</a>
        </div>
      </Section>

      <Section label="Colours and type">
        <Eyebrow>Tokens</Eyebrow>
        <H2>One accent. Everything else is ink.</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, margin: '32px 0' }}>
          {SWATCHES.map((t) => (
            <div key={t} style={{ border: '1px solid var(--border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: 64, background: `var(${t})` }} />
              <div style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>{t}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 'var(--fs-display)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>Display 96</div>
          <div style={{ fontSize: 'var(--fs-h2)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.025em' }}>Heading two</div>
          <div style={{ fontSize: 'var(--fs-h3)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Heading three</div>
          <Lede>Lede text, for the line under a heading. Inter at 21px.</Lede>
          <p style={{ maxWidth: '65ch', color: 'var(--text-body)' }}>Body text at 17px. It should read like a careful letter: short sentences, plain words, no exclamation marks.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Tag>Lagos</Tag><Tag>12 states</Tag><Tag>Reviewed by a lawyer</Tag></div>
        </div>
      </Section>

      <Section tone="muted" label="Run-log">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 48, alignItems: 'center' }}>
          <div>
            <Eyebrow>Run-log</Eyebrow>
            <H2>The product, shown working.</H2>
            <Lede>Real step names from the agents. The last line is always a person.</Lede>
          </div>
          <RunLog
            title="matter PLP-0142 · Notice to quit · Lagos"
            steps={[
              { status: 'done', text: 'Facts captured from the interview', detail: '11 facts' },
              { status: 'done', text: 'Tenancy: yearly, from 4 July 2023' },
              { status: 'done', text: 'Notice period worked out', detail: '6 months' },
              { status: 'done', text: 'Arrears worked out', detail: '₦3,500,000' },
              { status: 'done', text: 'Notice to quit drafted' },
              { status: 'next', text: 'Awaiting review by a lawyer' },
            ]}
          />
        </div>
      </Section>

      <Section label="How a matter moves">
        <Eyebrow>How a matter moves</Eyebrow>
        <H2>Five steps, and one of them is always a person.</H2>
        <div style={{ marginTop: 40 }}>
          <Pipeline
            steps={[
              { title: 'Interview', ai: 'Asks plain questions and saves each fact.', lawyer: 'Reads the facts if anything is unclear.' },
              { title: 'Draft', ai: 'Fills the firm’s template; works out dates and sums in code.', lawyer: 'Sets the templates and the rules.' },
              { title: 'Review', ai: 'Waits.', lawyer: 'Reads, corrects and signs every document.' },
              { title: 'Serve', ai: 'Prepares the service copy.', lawyer: 'Serves it, or tells you how.' },
              { title: 'Follow up', ai: 'Sends the Day 7 and Day 14 reminders.', lawyer: 'Takes it to court if it comes to that.' },
            ]}
          />
        </div>
      </Section>

      <Section tone="muted" label="Practice carousel">
        <Carousel label="Practice areas" heading={<><Eyebrow>Practice</Eyebrow><H2>What we draft today.</H2></>}>
          {PRACTICES.map((p) => (
            <article key={p.title} style={{ display: 'grid', gap: 16 }}>
              <DocumentPreview reference={p.ref} title={p.title} body={p.body} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <h3 style={{ fontSize: 20 }}>{p.title}</h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>{p.price}</span>
              </div>
            </article>
          ))}
        </Carousel>
      </Section>

      <Section label="Numbers and quote (samples)">
        <Eyebrow>Numbers · sample</Eyebrow>
        <H2>Every figure says what it counts.</H2>
        <div style={{ marginTop: 32 }}>
          <StatRow
            asOf="sample data, style guide only"
            items={[
              { value: '140', label: 'Letters of demand served', definition: 'Letters marked served in our records since launch.' },
              { value: '₦86m', label: 'Recovered for clients', definition: 'Payments clients reported after our letter.' },
              { value: '38 min', label: 'Average time to a draft', definition: 'From the first message to a document ready for review.' },
            ]}
          />
        </div>
        <div style={{ marginTop: 48 }}>
          <QuoteCard quote="We had chased this invoice for five months. The letter went out on Monday and they paid in full the following week." name="Sample Client" role="Director, sample company" metrics={[{ value: '₦2.4m', label: 'recovered' }, { value: '9 days', label: 'from letter to payment' }]} />
        </div>
      </Section>

      <Section tone="band" label="Photos">
        <Eyebrow>Photos · Admin → Site content</Eyebrow>
        <H2>Real photos, or a designed panel until then.</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 32 }}>
          {PHOTO_SLOTS.map((slot) => (
            <SitePhoto key={slot} photo={content.photos[slot]} label={PHOTO_SLOT_LABELS[slot].title} ratio={slot === 'founder' ? '4 / 5' : '4 / 3'} />
          ))}
        </div>
      </Section>

      <Container>
        <p style={{ padding: '40px 0', fontSize: 13, color: 'var(--text-3)' }}>End of style guide.</p>
      </Container>
    </main>
  )
}
