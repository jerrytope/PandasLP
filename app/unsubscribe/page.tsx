import type { Metadata } from 'next'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import UnsubscribeForm from './UnsubscribeForm'

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <>
      <Navbar />
      <main style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', padding: '140px 20px 96px' }}>
        <Suspense fallback={null}>
          <UnsubscribeForm />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
