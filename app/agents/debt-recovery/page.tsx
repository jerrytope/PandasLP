import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AgentPage from '@/components/AgentPage'

export const metadata: Metadata = {
  title: 'Debt Recovery',
  description:
    'A licensed Lagos law firm recovers what you are owed. Demand letter from ₦10,000, signed by a practitioner, followed up on Day 7 and Day 14, then filed at the Small Claims Court.',
  alternates: { canonical: '/agents/debt-recovery' },
}

export default function Page() {
  return (
    <>
      <Navbar />
      <main><AgentPage slug="debt-recovery" /></main>
      <Footer />
    </>
  )
}
