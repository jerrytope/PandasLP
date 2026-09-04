import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AgentPage from '@/components/AgentPage'

export const metadata: Metadata = {
  title: 'Property Law',
  description:
    'Notices to quit, tenancy and lease agreements, deeds of assignment and gift, powers of attorney and title searches. From ₦5,000, each signed by a licensed practitioner.',
  alternates: { canonical: '/agents/property-law' },
}

export default function Page() {
  return (
    <>
      <Navbar />
      <main><AgentPage slug="property-law" /></main>
      <Footer />
    </>
  )
}
