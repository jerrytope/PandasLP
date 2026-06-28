import './globals.css'

export const metadata = {
  title: 'Pandas LP — Professional Legal Services, Powered by AI',
  description: 'Pandas LP — Professional Legal Services, Powered by AI.',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
