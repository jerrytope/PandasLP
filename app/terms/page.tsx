import Link from 'next/link'
import WhatsAppFab from '@/components/WhatsAppFab'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

const TITLE = 'Terms of Use'
const DESCRIPTION = 'The terms governing your use of the Pandas LP platform and services.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
}

export default function TermsOfUsePage() {
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
            Terms of Use
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 40 }}>
            Last updated: 14 August 2026
          </p>

          <div className="blog-content">
            <p>
              <strong>Pandas LP</strong> ("we," "us," "our," "the Firm") is a CAC-registered
              law firm (Business Name BN 9646741) based in Lagos, Nigeria, operating the
              platform at pandaslp.com.ng ("the Platform," "the Service"). We use AI-assisted
              tools to conduct client interviews and prepare first drafts of legal documents;
              every document is reviewed by a licensed legal practitioner on our team before it
              is served, filed, or relied upon. <strong>Pandas LP is a law firm providing legal
              services — the Platform is the channel through which we deliver them, not a
              substitute for legal representation.</strong>
            </p>
            <p>
              These Terms of Use ("Terms") govern your access to and use of the Platform. By
              creating an account, submitting a case, or paying for a service, you agree to
              these Terms.
            </p>

            <h2>1. Acceptance of Terms &amp; Eligibility</h2>
            <p>
              1.1 By registering an account, starting a case with any AI agent, or making a
              payment on the Platform, you confirm that you have read, understood, and agree to
              be bound by these Terms and our <Link href="/privacy">Privacy Policy</Link>.
            </p>
            <p>
              1.2 <strong>Individual users:</strong> you must be at least 18 years old and
              legally capable of entering into a binding contract under Nigerian law.
            </p>
            <p>
              1.3 <strong>Business/entity users:</strong> if you use the Platform on behalf of a
              company, partnership, or other organization, you represent that you are authorized
              to bind that entity to these Terms, and &ldquo;you&rdquo; refers to both you
              individually and the entity you represent.
            </p>
            <p>
              1.4 We reserve the right to decline to open a matter or continue acting for any
              prospective or existing client, consistent with our professional obligations
              (including conflict-of-interest checks), at any stage before a fee is deemed
              earned.
            </p>
            <p>
              1.5 Account registration uses email magic-link sign-in (no password). You are
              responsible for maintaining control of the email address associated with your
              account, as it is the sole means of accessing your case data.
            </p>

            <h2>2. Scope of Services &amp; Disclaimer</h2>
            <h3>2.1 Services Offered</h3>
            <p>
              The Platform currently offers the following services, each delivered via a guided
              AI interview, document drafting, and review by a licensed practitioner before use:
            </p>
            <ul>
              <li><strong>Small Claims / Debt Recovery</strong> — recovering money owed to you
                through the Small Claims Court process (Forms SCA 1 &amp; 2) — letters of
                demand, filing assistance.</li>
              <li><strong>Landlord &amp; Tenant Dispute Review / Recovery of Premises</strong> —
                statutory notices to quit and recover rented property, and related tenancy
                dispute documentation.</li>
              <li><strong>Business Operationalization</strong> — contracts &amp; commercial
                agreements (NDAs, SLAs, employment agreements) and CAC business registration
                support.</li>
              <li><strong>Judgment Enforcement</strong> — garnishee orders and writs of
                execution to compel payment on an existing judgment.</li>
              <li><strong>Lawyer Consultation</strong> — direct consultation with a licensed
                practitioner on matters outside, or in addition to, the above.</li>
            </ul>
            <p>
              Current pricing for each service is published on the Platform and may change from
              time to time; the price shown to you at the point of engagement for a specific
              matter is the price that applies to that matter.
            </p>

            <h3>2.2 Nature of the Relationship — Important Disclaimer</h3>
            <p>
              2.2.1 <strong>This is not a self-help document template service.</strong> The AI
              interview is a tool we use to gather facts efficiently; it does not independently
              decide your legal strategy or finalize any document. A licensed legal
              practitioner at Pandas LP reviews every document before it is served, filed, or
              otherwise relied upon.
            </p>
            <p>
              2.2.2 <strong>Formation of the client relationship.</strong> An attorney-client
              relationship with Pandas LP is formed upon payment for a specific matter (or upon
              our written acceptance of your matter following intake, if that comes first), not
              merely by browsing the Platform, starting an AI interview, or creating an account.
              Information you share with the AI agent before that point is still handled
              confidentially per our Privacy Policy, but no representation is undertaken until
              engagement is confirmed.
            </p>
            <p>
              2.2.3 <strong>AI limitations.</strong> The AI agent may misunderstand facts you
              provide, and its draft output is a starting point for lawyer review, not a final
              legal opinion. You must review any document before it is used and flag anything
              that appears inaccurate.
            </p>
            <p>
              2.2.4 <strong>No guarantee of outcome.</strong> We do not and cannot guarantee
              that any claim will succeed, that a debtor will pay, that a tenant will vacate, or
              that a court will rule in your favor. Legal outcomes depend on facts, evidence,
              and judicial discretion outside our control.
            </p>
            <p>
              2.2.5 <strong>Court and third-party fees are separate.</strong> Filing fees paid
              to a court registry, CAC fees paid to the Corporate Affairs Commission, and
              similar third-party charges are not included in our service fee and are
              non-refundable by those third parties once paid.
            </p>

            <h2>3. User Responsibilities &amp; Acceptable Use</h2>
            <p>
              3.1 <strong>Accuracy of information.</strong> You must provide truthful,
              complete, and accurate information about your claim, your financial position, and
              any supporting evidence (invoices, receipts, correspondence, contracts, etc.) you
              submit. We rely on what you tell us to prepare your documents; inaccurate
              information may result in a defective document, a failed claim, or
              professional-conduct consequences for which you may be responsible.
            </p>
            <p>3.2 <strong>Lawful use only.</strong> You agree not to use the Platform to:</p>
            <ul>
              <li>Pursue a claim you know to be false, exaggerated, or fraudulent;</li>
              <li>Engage in unlawful debt-collection practices, including harassment, threats,
                or misrepresentation directed at a debtor or tenant beyond what a validly served
                legal document permits;</li>
              <li>Impersonate another person or entity, or submit a claim on behalf of someone
                without authority to do so;</li>
              <li>Attempt to gain unauthorized access to another user&rsquo;s account or case
                data, or to the Platform&rsquo;s underlying systems;</li>
              <li>Use the Platform&rsquo;s output (letters, notices, filings) for any purpose
                other than the matter for which it was prepared, without our consent.</li>
            </ul>
            <p>
              3.3 <strong>Consequences of misuse.</strong> Providing false information or
              misusing a document we prepare may result in suspension or termination of your
              account (Section 8), and you remain personally responsible for any legal
              consequences arising from your own conduct, including liability to a debtor,
              tenant, or third party.
            </p>

            <h2>4. Fees, Payments &amp; Financial Terms</h2>
            <p>
              4.1 <strong>Fees.</strong> Service fees are as published on the Platform at the
              time you engage a specific agent. Judgment Enforcement carries a base fee plus a
              percentage of the judgment recovered, as disclosed at the point of engagement.
            </p>
            <p>
              4.2 <strong>Payment processing.</strong> Payments are processed via Paystack. We
              do not receive or store your card or bank details; we receive confirmation of
              payment and the verified amount only. Every payment is independently verified
              against the amount quoted for your specific matter before your case is marked
              paid — we do not rely on client-side confirmation alone.
            </p>
            <p>
              4.3 <strong>Refunds.</strong> Refunds are governed by our{' '}
              <Link href="/refund-policy">Refund Policy</Link>. In summary: the drafting fee is
              non-refundable once your document has been prepared and delivered; refunds apply
              for duplicate charges, our own technical failure to deliver a document, or our
              own failure to complete a paid service-of-process. Court and CAC fees paid to
              third parties are not refundable by us.
            </p>
            <p>
              4.4 <strong>Judgment Enforcement percentage fee.</strong> Where a
              percentage-of-judgment fee applies, it is calculated on the judgment amount
              actually recovered, and is disclosed to you before you proceed.
            </p>
            <p>
              4.5 <strong>No hidden commissions.</strong> We do not take an undisclosed
              commission or referral fee from any third party (court, process server, or
              otherwise) in connection with your matter.
            </p>

            <h2>5. Data Privacy &amp; Confidentiality</h2>
            <p>
              5.1 Our collection, use, and protection of your personal data — including
              sensitive financial information, tenancy documents, and business records — is
              governed by our <Link href="/privacy">Privacy Policy</Link>, which is
              incorporated into these Terms by reference and complies with the Nigeria Data
              Protection Act 2023.
            </p>
            <p>
              5.2 <strong>Professional confidentiality.</strong> In addition to our
              data-protection obligations, case information you share with us is subject to
              legal professional privilege and confidentiality to the extent recognized under
              Nigerian law, once a client relationship is formed (see Section 2.2.2).
            </p>
            <p>
              5.3 We do not sell your data. We share it only with the service providers
              necessary to deliver the service (our AI provider, payment processor, and
              database provider — see the Privacy Policy for the current list) and with the
              counterparty against whom your document is served, which is the intended function
              of the service.
            </p>

            <h2>6. Intellectual Property</h2>
            <p>
              6.1 <strong>Our property.</strong> The Platform&rsquo;s software, AI-assisted
              workflows, document templates, underlying prompts and system design, brand name,
              logo, and all associated marks are the property of Pandas LP or its licensors.
              Nothing in these Terms grants you any right to copy, reverse-engineer, or create
              derivative works from the Platform itself.
            </p>
            <p>
              6.2 <strong>Your content.</strong> You retain ownership of the facts, evidence,
              and documents you submit to us. You grant us a license to use that content solely
              to prepare, review, serve, and file documents on your behalf, and to comply with
              our professional and legal obligations.
            </p>
            <p>
              6.3 <strong>Your finished document.</strong> Once delivered, the specific document
              prepared for your matter (e.g., your Letter of Demand) is yours to use for that
              matter. This does not transfer ownership of the underlying template, workflow, or
              system that produced it.
            </p>

            <h2>7. Limitation of Liability &amp; Warranty Disclaimers</h2>
            <p>
              7.1 <strong>Platform provided &ldquo;as is.&rdquo;</strong> The Platform,
              including the AI interview tool, is provided on an &ldquo;as is&rdquo; and
              &ldquo;as available&rdquo; basis. While we take reasonable care in the
              professional services we deliver (document review, drafting, filing), we do not
              warrant that the Platform will be uninterrupted, error-free, or free of technical
              defects.
            </p>
            <p>
              7.2 <strong>No warranty of outcome.</strong> As stated in Section 2.2.4, we do
              not warrant or guarantee the outcome of any claim, dispute, filing, or enforcement
              action.
            </p>
            <p>
              7.3 <strong>Limitation of monetary liability.</strong> To the maximum extent
              permitted by Nigerian law, our aggregate liability to you arising out of or
              relating to the Platform or these Terms shall not exceed the total fees you paid
              us for the specific matter giving rise to the claim, except where such limitation
              is not permitted by law or would be inconsistent with our professional-conduct
              obligations as legal practitioners (which cannot be excluded by contract).
            </p>
            <p>
              7.4 <strong>Excluded losses.</strong> To the maximum extent permitted by law, we
              are not liable for indirect, incidental, or consequential losses, including loss
              of profit or loss of the underlying debt/claim itself where that loss results from
              factors outside our control (e.g., a debtor&rsquo;s insolvency, a court&rsquo;s
              decision, or inaccurate information you provided).
            </p>
            <p>
              7.5 <strong>Indemnification by user.</strong> You agree to indemnify and hold
              Pandas LP harmless from claims, losses, or expenses arising from: (a) false or
              inaccurate information you provided, (b) your misuse of a document we prepared,
              or (c) your breach of Section 3 (Acceptable Use).
            </p>

            <h2>8. Termination of Access</h2>
            <p>
              8.1 <strong>By you.</strong> You may stop using the Platform and request deletion
              of your account data at any time, subject to our retention obligations described
              in the Privacy Policy and any matter already in progress.
            </p>
            <p>
              8.2 <strong>By us.</strong> We may suspend or terminate your access to the
              Platform, with or without notice, if we reasonably believe you have: violated
              Section 3 (Acceptable Use), provided materially false information, engaged in
              fraudulent or unlawful conduct, or where continuing to act for you would conflict
              with our professional obligations.
            </p>
            <p>
              8.3 <strong>Effect of termination.</strong> Termination does not affect fees
              already earned for work completed, nor does it affect our professional
              obligations regarding any matter already undertaken (e.g., safekeeping and
              eventual return of your case file, per applicable professional-conduct rules).
            </p>

            <h2>9. Governing Law &amp; Dispute Resolution</h2>
            <p>
              9.1 <strong>Governing law.</strong> These Terms are governed by the laws of the
              Federal Republic of Nigeria, specifically Lagos State.
            </p>
            <p>
              9.2 <strong>Venue.</strong> Subject to Section 9.3, any dispute arising from these
              Terms shall be subject to the exclusive jurisdiction of the courts of Lagos State,
              Nigeria.
            </p>
            <p>
              9.3 <strong>No mandatory arbitration.</strong> Disputes are resolved through the
              ordinary courts named in Section 9.2, not private arbitration. As a firm whose own
              service is helping clients access the courts, we don&rsquo;t ask our own clients to
              waive that same access when the dispute is with us.
            </p>
            <p>
              9.4 <strong>Complaints.</strong> Before pursuing formal dispute resolution, you
              agree to first raise any concern with us at{' '}
              <a href="mailto:pandaslegalpractitioners@gmail.com">
                pandaslegalpractitioners@gmail.com
              </a>, so we have an opportunity to resolve it directly.
            </p>

            <h2>10. General</h2>
            <p>
              10.1 <strong>Changes to these Terms.</strong> We may update these Terms from time
              to time. Material changes will be reflected here with an updated &ldquo;Last
              updated&rdquo; date. Continued use of the Platform after a change constitutes
              acceptance of the updated Terms.
            </p>
            <p>
              10.2 <strong>Severability.</strong> If any provision of these Terms is found
              unenforceable, the remaining provisions continue in full force.
            </p>
            <p>
              10.3 <strong>Entire agreement.</strong> These Terms, together with the Privacy
              Policy and Refund Policy, constitute the entire agreement between you and Pandas
              LP regarding use of the Platform, save for any separate written engagement letter
              or retainer agreement entered into for a specific matter, which shall govern that
              matter to the extent of any conflict.
            </p>
            <p>
              10.4 <strong>Contact.</strong> Questions about these Terms can be sent to{' '}
              <a href="mailto:pandaslegalpractitioners@gmail.com">
                pandaslegalpractitioners@gmail.com
              </a>{' '}
              or +234 811 808 0189.
            </p>

            <p style={{ marginTop: 32, fontStyle: 'italic' }}>
              Pandas LP — CAC Business Name BN 9646741 — Lagos, Nigeria
            </p>
          </div>
        </article>
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  )
}
