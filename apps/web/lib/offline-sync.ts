// lib/offline-sync.ts
// On-site check-in PWA — P1b sync. Drains the offline outbox once the device is
// back online, replaying each queued check-in through the SAME insert + seal
// path the live flow uses (participant upsert → waiver insert → seal +
// writeback → confirmation/marketing/reservation follow-ups). Runs in the page
// (browser) context, not the service worker, so it can use the anon Supabase
// client + client-side sealing — and so it works on every platform (no reliance
// on the SW Background Sync API, which iOS lacks).
//
// Idempotent on the client-generated waiverId: a re-sync of an already-inserted
// waiver (23505) is treated as "continue to seal", so a partial prior sync
// still completes. A fully-synced item is removed from the outbox.

import { createClient } from '@/lib/supabase-anon'
import { sealWaiver } from '@/lib/seal'
import { resolveTemplateVersionForSession } from '@/lib/document-engine'
import { fetchBranding, EMPTY_BRANDING } from '@/lib/branding'
import { listOutbox, removeFromOutbox, outboxCount, type QueuedCheckIn } from '@/lib/offline-store'

export interface SyncResult { synced: number; failed: number; remaining: number }

/** Drain the outbox. Safe to call repeatedly (on launch, on `online`, on a
 *  manual retry). No-op when offline. */
export async function syncOutbox(): Promise<SyncResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, failed: 0, remaining: await outboxCount() }
  }
  const items = await listOutbox()
  let synced = 0, failed = 0
  for (const rec of items) {
    try {
      await persistQueuedCheckIn(rec)
      await removeFromOutbox(rec.waiverId)
      synced++
    } catch {
      // Leave it in the outbox to retry on the next trigger.
      failed++
    }
  }
  return { synced, failed, remaining: await outboxCount() }
}

async function persistQueuedCheckIn(rec: QueuedCheckIn): Promise<void> {
  const supabase = createClient()
  const a = rec.answers

  // 1. Participant
  const { data: participant, error: pErr } = await supabase
    .from('participants')
    .upsert({ email: a.email, full_name: a.fullName, dob: a.dob }, { onConflict: 'email' })
    .select('id').single()
  if (pErr) throw new Error(`participant: ${pErr.message}`)
  if (!participant) throw new Error('participant upsert returned no data')

  // 2. Resolve the session (the queued record holds the raw session param).
  const { data: session, error: sErr } = await supabase
    .from('sessions').select('id').eq('id', rec.sessionId).maybeSingle()
  if (sErr) throw new Error(`session: ${sErr.message}`)
  if (!session) throw new Error('session not found')
  // Note: a session archived AFTER an offline signature is not re-checked here —
  // the signature legally happened while the session was open; discarding it on
  // sync would lose a valid waiver.

  const templateVersionId = await resolveTemplateVersionForSession(supabase, session.id, rec.activityKey).catch(() => null)

  // 3. Insert the waiver (idempotent on the client-generated id).
  const { error: wErr } = await supabase.from('waivers').insert({
    id:             rec.waiverId,
    session_id:     session.id,
    participant_id: participant.id,
    operator_id:    rec.operatorId,
    activity_key:   rec.activityKey,
    answers:        a,
    clauses:        rec.clauses,
    signed_at:      rec.signedAt,
    signature_data: rec.signatureData,
    is_minor:       a.isMinor ?? false,
    guardian_name:  a.guardianName ?? null,
    ip_address:     rec.ipAddress,
    template_version_id: templateVersionId,
    reservation_id: rec.reservationId ?? null,
    // Auto check-in (per-arrival): an offline check-in is an on-site kiosk
    // signature. A walk-up/group check-in (no member token) is an arrival, so
    // stamp checked_in_at; an advance member-invite link is left for the
    // operator's group check-in. Mirrors the live flow in ParticipantFlow.
    checked_in_at: rec.reservationId && !rec.memberToken ? rec.signedAt : null,
  })
  // 23505 = unique_violation → already inserted by a previous partial sync;
  // fall through and (re)seal so the row still ends up sealed.
  if (wErr && (wErr as { code?: string }).code !== '23505') throw new Error(`waiver: ${wErr.message}`)

  // 4. Seal (branding re-fetched online) + write back the hash/pdf path.
  const branding = await fetchBranding(supabase, rec.operatorId).catch(() => EMPTY_BRANDING)
  try {
    const sealResult = await sealWaiver(supabase, {
      waiverId:      rec.waiverId,
      fullName:      a.fullName,
      email:         a.email,
      dob:           a.dob,
      activityKey:   rec.activityKey,
      activityLabel: rec.activityLabel,
      signedAt:      rec.signedAt,
      ipAddress:     rec.ipAddress,
      isMinor:       a.isMinor ?? false,
      guardianName:  a.guardianName ?? null,
      guardianSignatureData: a.guardianSig ?? null,
      clauses:       rec.clauses,
      signatureData: rec.signatureData,
      logoUrl:       branding.logoUrl,
      primaryColor:  branding.primaryColor,
      operatorName:  rec.operatorName,
    })
    await fetch(`/api/waivers/${rec.waiverId}/seal-writeback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentHash: sealResult.documentHash, pdfPath: sealResult.pdfPath }),
    }).catch(() => {})
  } catch (sealErr) {
    await fetch(`/api/waivers/${rec.waiverId}/seal-writeback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sealError: sealErr instanceof Error ? sealErr.message : 'seal failed' }),
    }).catch(() => {})
  }

  // 5. Fire-and-forget follow-ups (same as the live finish path).
  fetch(`/api/waivers/${rec.waiverId}/send-confirmation`, { method: 'POST' }).catch(() => {})
  if (rec.marketingEmailConsent || rec.marketingSmsConsent) {
    fetch('/api/marketing/opt-in', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        waiverId: rec.waiverId, email: a.email, phone: rec.phone, fullName: a.fullName,
        emailConsent: rec.marketingEmailConsent, smsConsent: rec.marketingSmsConsent,
      }),
    }).catch(() => {})
  }
  if (rec.reservationId) {
    fetch('/api/reservations/member-complete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waiverId: rec.waiverId, memberToken: rec.memberToken, reservationId: rec.reservationId }),
    }).catch(() => {})
  }
}
