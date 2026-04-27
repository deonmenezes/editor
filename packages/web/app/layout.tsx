import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pascal — shared world',
  description: 'A live 3D world built collaboratively through Claude. Edits sync via CRDT.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
