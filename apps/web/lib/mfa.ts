// lib/mfa.ts
// Operator multi-factor authentication — a thin, typed wrapper over
// supabase.auth.mfa. Nothing here invents crypto: TOTP secrets, SMS
// codes, QR provisioning and the assurance-level (AAL) machinery all
// live inside Supabase Auth. This module only gives the UI a small,
// intention-revealing surface and papers over two rough edges:
//
//   1. Unverified factors accumulate. If a user starts an enrollment
//      (which creates a factor row immediately) and abandons it before
//      entering a code, that half-finished factor lingers and later
//      collides on friendly-name uniqueness. Every enroll here first
//      sweeps away leftover *unverified* factors of the same type.
//   2. The factor-type union. enroll() returns different shapes for
//      'totp' (a qr_code) vs 'phone' (a masked number); callers only
//      ever want one, so each helper returns exactly that.
//
// Enforcement policy for LIABL: MFA is REQUIRED for every operator user.
// That rule is applied at the gate (login page + middleware AAL check),
// not here — this file is the mechanism, not the policy.

import { createClient } from '@/lib/supabase'

export type FactorType = 'totp' | 'phone'

export interface MfaFactor {
  id: string
  type: FactorType
  friendlyName: string | null
  /** Masked phone (Supabase returns only the last digits) for phone factors. */
  phone?: string | null
}

export interface AssuranceLevel {
  /** null when there is no session at all (i.e. signed out). */
  currentLevel: 'aal1' | 'aal2' | null
  /** The level this user *could* reach — 'aal2' once any factor is verified. */
  nextLevel: 'aal1' | 'aal2' | null
}

export interface TotpEnrollment {
  factorId: string
  /** An <img>-ready SVG data URL of the provisioning QR code. */
  qrCode: string
  /** The raw shared secret, for manual entry when a camera isn't available. */
  secret: string
}

interface RawFactor { id: string; factor_type: string; status: string; friendly_name?: string | null; phone?: string | null }

/** All VERIFIED factors on the current user — the ones that actually gate
 * login. Derived from `data.all` (present across client versions) rather
 * than the typed `.totp`/`.phone` getters, so this compiles the same
 * whether or not the installed client exposes a phone getter. */
export async function listFactors(): Promise<MfaFactor[]> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  const all = ((data as unknown as { all?: RawFactor[] })?.all ?? [])
  return all
    .filter(f => f.status === 'verified' && (f.factor_type === 'totp' || f.factor_type === 'phone'))
    .map(f => ({
      id: f.id,
      type: f.factor_type as FactorType,
      friendlyName: f.friendly_name ?? null,
      phone: f.phone ?? null,
    }))
}

/** Current + next assurance level. currentLevel === null means signed out. */
export async function getAssuranceLevel(): Promise<AssuranceLevel> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw new Error(error.message)
  return {
    currentLevel: (data?.currentLevel ?? null) as AssuranceLevel['currentLevel'],
    nextLevel: (data?.nextLevel ?? null) as AssuranceLevel['nextLevel'],
  }
}

/** Remove any factor of `type` that was started but never verified, so a
 * fresh enrollment can't collide with an abandoned one. Best-effort. */
async function sweepUnverified(type: FactorType): Promise<void> {
  const supabase = createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  // listFactors' typed getters (data.totp/data.phone) return verified only;
  // the raw `data.all` carries status, which is where stragglers show up.
  const all = (data as unknown as { all?: Array<{ id: string; factor_type: string; status: string }> })?.all ?? []
  for (const f of all) {
    if (f.factor_type === type && f.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {})
    }
  }
}

/** Begin authenticator-app enrollment: returns the QR + secret to display.
 * Complete it by calling verifyEnrollment() with a code from the app. */
export async function enrollTotp(friendlyName = 'Authenticator app'): Promise<TotpEnrollment> {
  const supabase = createClient()
  await sweepUnverified('totp')
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName })
  if (error) throw new Error(error.message)
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Begin SMS enrollment for an E.164 phone number. This does NOT send a
 * code yet — call sendChallenge(factorId) to text one, then
 * verifyEnrollment(). Returns the new factor id. */
export async function enrollPhone(phone: string, friendlyName = 'Text message'): Promise<string> {
  const supabase = createClient()
  await sweepUnverified('phone')
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'phone', friendlyName, phone })
  if (error) throw new Error(error.message)
  return data.id
}

/** Create a challenge against a factor. For phone factors this sends the
 * SMS code; for TOTP it just opens a short-lived window to submit a code.
 * Returns the challengeId to pass to verify(). */
export async function sendChallenge(factorId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.mfa.challenge({ factorId })
  if (error) throw new Error(error.message)
  return data.id
}

/** Verify a code against an open challenge. On success the session steps
 * up to aal2. Throws with a friendly message on a wrong/expired code. */
export async function verifyCode(factorId: string, challengeId: string, code: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: code.trim() })
  if (error) throw new Error(error.message)
}

/** Convenience: challenge + verify in one call (used to finish enrollment
 * and to step up an existing factor). */
export async function challengeAndVerify(factorId: string, code: string): Promise<void> {
  const challengeId = await sendChallenge(factorId)
  await verifyCode(factorId, challengeId, code)
}

/** Remove a factor. Supabase requires the session to already be aal2 to
 * unenroll, which is always true inside the console (MFA is enforced). */
export async function unenrollFactor(factorId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}
