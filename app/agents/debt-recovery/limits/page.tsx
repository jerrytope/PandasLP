import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AgentLimitsPage from '@/components/AgentLimitsPage'
import { AGENT_PAGES } from '@/lib/agentPagesData'
import { safeJsonLd } from '@/lib/jsonLd'

export const metadata: Metadata = {
  title: 'Where the AI Stops and a Lawyer Starts: Debt Recovery',
  description:
    "Every refusal built into Pandas LP's debt recovery agent — what it will not take on, and why a licensed practitioner reviews and signs everything it drafts.",
  alternates: { canonical: '/agents/debt-recovery/limits' },
}

export default function Page() {
  const limits = AGENT_PAGES['debt-recovery'].limits

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: limits.map((l) => ({
      '@type': 'Question',
      name: l.t,
      acceptedAnswer: { '@type': 'Answer', text: l.b },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      <Navbar />
      <main><AgentLimitsPage slug="debt-recovery" /></main>
      <Footer />
    </>
  )
}
