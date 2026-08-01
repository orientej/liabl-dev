// lib/marketing.ts
// Marketing automation — M1. SERVER-ONLY (node crypto + service-role client).
// Records per-operator, per-channel marketing consent captured at check-in
// and emits the marketing.contact webhook. Consent here is SEPARATE from the
// transactional confirmation email — a participant can sign a waiver without
// opting into marketing.

import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { emitWebhookEvent } from '@/lib/webhooks'

type AdminClient = ReturnType<typeof createAdminClient>

export function generateUnsubscribeToken(): string {
  return `unsub_${crypto.randomBytes(18).toString('base64url')}`
}

export interface OptInInput {
  operatorId: string
  email: string
  phone?: string | null
  fullName?: string | null
  participantId?: string | null
  emailConsent: boolean
  smsConsent: boolean
}

/**
 * Upsert a marketing contact from a check-in opt-in. Consent is additive
 * (opting in never silently revokes a channel the person already granted),
 * timestamps are stamped when a channel is newly granted, and re-opting in
 * clears a prior unsubscribe for that channel. Emits marketing.contact.
 * Best-effort on the webhook — a delivery problem never fails the opt-in.
 */
export async function recordMarketingOptIn(admin: AdminClient, input: OptInInput): Promise<void> {
  const email = input.email.trim().toLowerCase()
  if (!email) return
  const now = new Date().toISOString()

  const { data: existing } = await admin
    .from('marketing_contacts')
    .select('id, email_consent, sms_consent, unsubscribe_token')
    .eq('operator_id', input.operatorId).eq('email', email).maybeSingle()

  const emailConsent = input.emailConsent || !!existing?.email_consent
  const smsConsent   = input.smsConsent   || !!existing?.sms_consent

  const row: Record<string, unknown> = {
    operator_id:       input.operatorId,
    email,
    phone:             input.phone?.trim() || null,
    full_name:         input.fullName?.trim() || null,
    participant_id:    input.participantId ?? null,
    email_consent:     emailConsent,
    sms_consent:       smsConsent,
    unsubscribe_token: existing?.unsubscribe_token ?? generateUnsubscribeToken(),
    updated_at:        now,
  }
  if (input.emailConsent && !existing?.email_consent) { row.email_consent_at = now; row.unsubscribed_email_at = null }
  if (input.smsConsent && !existing?.sms_consent)     { row.sms_consent_at = now;   row.unsubscribed_sms_at = null }

  const { error } = await admin.from('marketing_contacts').upsert(row, { onConflict: 'operator_id,email' })
  if (error) throw new Error(`opt-in: ${error.message}`)

  await emitWebhookEvent(admin, {
    operatorId: input.operatorId,
    eventType: 'marketing.contact',
    data: { email, phone: row.phone, full_name: row.full_name, email_consent: emailConsent, sms_consent: smsConsent },
  })
}
