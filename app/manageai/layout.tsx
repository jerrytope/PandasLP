import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Manage the agents · Pandas LP',
  robots: { index: false, follow: false },
}

export default function ManageAiLayout({ children }: { children: ReactNode }) {
  return children
}
