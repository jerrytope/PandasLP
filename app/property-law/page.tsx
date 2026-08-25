import { redirect } from 'next/navigation'

// Unlisted preview link for the Property Law Agent — not linked from the homepage
// (it's still shown as "Coming Soon" there) and excluded from robots.ts. Points at the
// same agent route every other agent uses; the id stays recovery-of-premises internally.
export default function PropertyLawRedirect() {
  redirect('/agent/recovery-of-premises')
}
