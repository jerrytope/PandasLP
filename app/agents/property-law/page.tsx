import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AgentPage from '@/components/AgentPage'

export const metadata: Metadata = {
  title: 'Property Law',
  description:
    'Tenancy and lease documents at ₦25,000, deeds transferring title at 2.5% of the consideration, and property searches carried out by the firm. Each document signed by a licensed practitioner.',
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
