'use client'
// On-site check-in PWA — registers the service worker for the check-in flow.
// Mounted on the participant page only, and scoped to /participant, so the SW
// never controls the operator console or marketing site. No-op on
// non-secure origins (SW requires https, except localhost) and where
// unsupported.
import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
    if (!secure) return
    navigator.serviceWorker.register('/sw.js', { scope: '/participant' }).catch(() => { /* non-fatal */ })
  }, [])
  return null
}
