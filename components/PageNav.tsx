'use client'
import Link from 'next/link'
import Logo from '@/components/Logo'

interface Props {
  badge?: string                  // optional right-side context badge ("Operator", "Participant", etc.)
  homeHref?: string               // override home destination
  operatorName?: string           // shown beneath wordmark when present
  operatorAccent?: string         // logo mark color override
  showHomeButton?: boolean        // default true — set false on the homepage itself
}

export default function PageNav({
  badge,
  homeHref = '/',
  operatorName,
  operatorAccent,
  showHomeButton = true,
}: Props) {
  return (
    <nav className="bg-white border-b border-black/10 px-5 py-3 flex items-center justify-between sticky top-0 z-40">
      <Link href={homeHref} aria-label="Go to home" className="hover:opacity-90 transition-opacity">
        <Logo size="md" operatorName={operatorName} operatorAccent={operatorAccent}/>
      </Link>
      <div className="flex items-center gap-3">
        {badge && (
          <span className="text-xs bg-surface border border-black/10 px-3 py-1.5 rounded-full text-gray-500">
            {badge}
          </span>
        )}
        {showHomeButton && (
          <Link href="/"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-black/15 text-gray-600 hover:bg-surface hover:text-ink transition-all"
            aria-label="Return to home page">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11 L12 3 L21 11"/>
              <path d="M5 10 L5 20 C5 20.5 5.5 21 6 21 L18 21 C18.5 21 19 20.5 19 20 L19 10"/>
              <path d="M10 21 L10 14 L14 14 L14 21"/>
            </svg>
            <span className="hidden sm:inline">Home</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
