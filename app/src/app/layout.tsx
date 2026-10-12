import type { Metadata } from 'next'
import '../index.css'
import './portal.css'
import { getAppConfig } from '@/lib/app-config'

const { appName } = getAppConfig()

export const metadata: Metadata = {
  title: `${appName} | People Operations`,
  description: 'Secure employee attendance and people operations portal.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}