import type { ReactNode } from 'react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { getSiteContent } from '@/lib/siteContent'
import { publicSiteContent, type PublicSiteContent } from '@/lib/siteContentSchema'

// The frame for the public pages built on "Ink & Brass": the header (with the announcement bar
// from Admin → Site content), the page, the footer. A server component; children may take the
// published content through the render prop.
export default async function PublicPage({ children }: { children: ReactNode | ((content: PublicSiteContent) => ReactNode) }) {
  const content = publicSiteContent(await getSiteContent())
  return (
    <>
      <Navbar announcement={content.announcement} />
      <main>{typeof children === 'function' ? children(content) : children}</main>
      <Footer />
    </>
  )
}
