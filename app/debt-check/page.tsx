import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import DebtCheck from '@/components/DebtCheck'
import WhatsAppFab from '@/components/WhatsAppFab'
import s from '@/components/DebtCheck.module.css'

const title = 'Free Debt Check: Can You Get Your Money Back?'
const description =
  'Owed money in Nigeria? Answer seven quick questions and see how strong your case is, what to do next and what it costs. Free, from a licensed Lagos law firm.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/debt-check' },
  openGraph: { type: 'website', title: `${title} | Pandas LP`, description, url: '/debt-check' },
  twitter: { card: 'summary_large_image', title: `${title} | Pandas LP`, description },
}

export default function Page() {
  return (
    <>
      <Navbar />
      <main className={s.wrap}>
        <DebtCheck />
      </main>
      <Footer />
      <WhatsAppFab />
    </>
  )
}
