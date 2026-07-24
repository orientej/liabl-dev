'use client'
import PageNav from '@/components/PageNav'
import OnboardingTab from '@/components/operator/OnboardingTab'

export default function StartPage() {
  return (
    <main className="min-h-screen bg-surface">
      <PageNav badge="Start Free Trial" />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Free Trial · No Credit Card Required</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink mb-3" style={{ letterSpacing:'-0.025em' }}>
            Start in 15 minutes.
          </h1>
          <p className="text-muted text-base leading-relaxed max-w-xl mx-auto">
            Configure your first activity template, send your first invite, and see a signed waiver appear in your dashboard —
            all in under 15 minutes.
          </p>
        </div>
        <OnboardingTab />
      </div>
    </main>
  )
}
