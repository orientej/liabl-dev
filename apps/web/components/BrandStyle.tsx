// components/BrandStyle.tsx
// Private labeling — injects the per-operator color theme. Renders a single
// <style> that sets the --brand-rgb / --accent-rgb (and shade) CSS variables
// the Tailwind preset reads, so every bg-brand / text-brand / bg-brand/10
// class on the page themes to the operator's colors, alpha preserved.
//
// Renders nothing when the operator has no valid colors — the preset's
// built-in fallbacks then reproduce the default Liabl palette. Safe in both
// server and client components (pure render, no hooks).

import { brandingCss, type Branding } from '@/lib/branding'

export default function BrandStyle({ branding }: { branding: Branding }) {
  const css = brandingCss(branding)
  if (!css) return null
  // eslint-disable-next-line react/no-danger
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
