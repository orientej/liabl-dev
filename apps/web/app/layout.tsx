import type { Metadata, Viewport } from 'next'
import { DM_Sans, Syne, JetBrains_Mono } from 'next/font/google'
import '@liabl/ui/globals.css'

const dmSans = DM_Sans({ subsets:['latin'], variable:'--font-dm-sans', weight:['300','400','500','600'], display:'swap' })
const syne   = Syne({ subsets:['latin'], variable:'--font-syne', weight:['500','600','700'], display:'swap' })
const mono   = JetBrains_Mono({ subsets:['latin'], variable:'--font-mono', weight:['400','500'], display:'swap' })

export const metadata: Metadata = {
  title: 'LIABL — Think faster. Decide better.',
  description: 'The modern document layer that bridges information, action, and intelligence.',
  // On-site check-in PWA (the manifest is auto-linked from app/manifest.ts).
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Liabl' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#4B2ACF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${syne.variable} ${mono.variable}`}>
      <body className="bg-surface font-sans text-ink antialiased">{children}</body>
    </html>
  )
}
