import type { Metadata } from 'next'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import UploadSignedForms from './UploadSignedForms'

// Where the private link in the filing-pack e-mail lands (lib/uploadLink.ts). Never indexed.
export const metadata: Metadata = {
  title: 'Upload your signed forms',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
    <>
      <Navbar />
      <main style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto', padding: '140px 20px 96px' }}>
        <Suspense fallback={null}>
          <UploadSignedForms />
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
