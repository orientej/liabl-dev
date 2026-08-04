// lib/trusted-device.ts
// Client helpers for the "remember this device" MFA bypass. The trust
// itself is an HttpOnly cookie the browser can't read — so the yes/no
// question ("is this device trusted?") is answered by the server route,
// not by inspecting a cookie here. Listing and revoking devices, by
// contrast, read the trusted_devices table directly under RLS (each user
// sees only their own rows).
import { createClient } from '@/lib/supabase'

/** Ask the server whether the current browser is a trusted device for the
 * signed-in user. Returns false on any error — failing closed means the
 * worst case is an extra second-factor prompt, never a skipped one. */
export async function isDeviceTrusted(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/trusted-device', { method: 'GET' })
    if (!res.ok) return false
    const body = await res.json()
    return body?.trusted === true
  } catch {
    return false
  }
}

/** Mark the current browser trusted for 30 days. Call this right after a
 * successful second-factor verification when the user opted in. */
export async function rememberThisDevice(): Promise<void> {
  await fetch('/api/auth/trusted-device', { method: 'POST' })
}

/** Untrust the current browser (revokes the row and clears the cookie). */
export async function forgetThisDevice(): Promise<void> {
  await fetch('/api/auth/trusted-device', { method: 'DELETE' })
}

export interface TrustedDevice {
  id: string
  userAgent: string | null
  createdAt: string
  lastUsedAt: string
  expiresAt: string
}

/** The signed-in user's trusted devices, most-recently-used first. RLS
 * scopes this to their own rows. */
export async function listTrustedDevices(): Promise<TrustedDevice[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('trusted_devices')
    .select('id, user_agent, created_at, last_used_at, expires_at')
    .order('last_used_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((d: {
    id: string; user_agent: string | null; created_at: string; last_used_at: string; expires_at: string
  }) => ({
    id: d.id,
    userAgent: d.user_agent,
    createdAt: d.created_at,
    lastUsedAt: d.last_used_at,
    expiresAt: d.expires_at,
  }))
}

/** Revoke a trusted device by id. RLS ensures a user can only delete their
 * own. The matching cookie, if any, becomes inert on its next check. */
export async function revokeTrustedDevice(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('trusted_devices').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
