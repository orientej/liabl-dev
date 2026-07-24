/**
 * Shared Tailwind theme. Both apps extend this preset rather than each
 * carrying their own palette, so brand colours and typography cannot
 * quietly diverge between the marketing site and the product.
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
        // Brand primary
        brand:   { DEFAULT:'#4B2ACF', light:'#EEE9FF', mid:'#6344E0', deep:'#3A1FA5' },
        // Accent — energy, momentum, secondary CTAs
        accent:  { DEFAULT:'#EA580C', light:'#FFEDD5', deep:'#C2410C' },
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
