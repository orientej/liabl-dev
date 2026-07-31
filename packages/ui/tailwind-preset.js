/**
 * Shared Tailwind theme. Both apps extend this preset rather than each
 * carrying their own palette, so brand colours and typography cannot
 * quietly diverge between the marketing site and the product.
 *
 * Private labeling: `brand` and `accent` are expressed as
 * `rgb(var(--…-rgb, <default channels>) / <alpha-value>)` so a per-operator
 * <BrandStyle> can override them at runtime by setting the CSS variables.
 * When NO variable is set each falls back to its original hex exactly
 * (`75 42 207` = #4B2ACF), so the marketing site and operator console render
 * pixel-identical — only branded participant surfaces set the variables. The
 * `<alpha-value>` placeholder keeps modifiers like `bg-brand/10` working.
 */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans:  ['DM Sans', 'sans-serif'],
        serif: ['Syne', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Brand primary — themeable per operator (defaults = #4B2ACF ramp)
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb, 75 42 207) / <alpha-value>)',
          light:   'rgb(var(--brand-light-rgb, 238 233 255) / <alpha-value>)',
          mid:     'rgb(var(--brand-mid-rgb, 99 68 224) / <alpha-value>)',
          deep:    'rgb(var(--brand-deep-rgb, 58 31 165) / <alpha-value>)',
        },
        // Accent — themeable per operator (defaults = #EA580C ramp)
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb, 234 88 12) / <alpha-value>)',
          light:   'rgb(var(--accent-light-rgb, 255 237 213) / <alpha-value>)',
          deep:    'rgb(var(--accent-deep-rgb, 194 65 12) / <alpha-value>)',
        },
        // Success — RESERVED for Signed/Verified moments ONLY
        success: { DEFAULT:'#15803D', light:'#DCFCE7', deep:'#14532D' },
        // Slate — structural color for non-verification positive moments
        slate:   { DEFAULT:'#334155', light:'#F1F5F9', mid:'#475569', deep:'#1E293B' },
        // Surfaces and text
        surface: '#F7F6F2',
        ink:     '#0D0E12',
        muted:   '#6B7280',
      },
    },
  },
}
