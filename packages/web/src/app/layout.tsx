import type { ReactNode } from 'react'

export const metadata = {
  title: 'YC Intelligence',
  description: 'YC company intelligence workspace'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
