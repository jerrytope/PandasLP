import HomeApp from '@/components/home/HomeApp'
import { getSiteContent } from '@/lib/siteContent'
import { publicSiteContent } from '@/lib/siteContentSchema'
import { BLOG_POSTS } from '@/lib/blogPosts'

// The homepage. Loads what staff publish in Admin → Site content (photos, announcement, and
// numbers and quotes only once switched on) on the server, then hands it to the interactive
// page (components/home/HomeApp.jsx), which also runs the custom-claim, payment and
// judgment-enforcement steps. Refreshed at most once a minute.
export const revalidate = 60

export default async function Page() {
  const content = publicSiteContent(await getSiteContent())
  const notes = [...BLOG_POSTS]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((p) => ({ slug: p.slug, title: p.title, description: p.description, date: p.date }))
  return <HomeApp content={content} notes={notes} />
}
