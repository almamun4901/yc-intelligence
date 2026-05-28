import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'YC Intelligence Dashboard',
  description: 'Research cockpit for Y Combinator startup intelligence'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
