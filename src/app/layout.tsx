import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DealMind AI — Real Estate Investment Analyzer',
  description: 'AI-powered off-market real estate deal analyzer. Wholesale, Subject-To, Owner Finance, Multi-Family, Airbnb — every exit strategy scored instantly.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
