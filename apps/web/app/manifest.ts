import type { MetadataRoute } from 'next'

// On-site check-in PWA — web manifest (Next App Router serves this at
// /manifest.webmanifest and auto-links it). Scoped to /participant so the
// installable app IS the check-in flow — not the operator console or the
// marketing site.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Liabl Check-In',
    short_name: 'Liabl',
    description: 'On-site participant check-in and waiver signing.',
    start_url: '/participant',
    scope: '/participant',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F7F6F2',
    theme_color: '#4B2ACF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
