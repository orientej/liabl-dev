// lib/marketing-automations.ts
// Marketing automation — M3 lifecycle automations. SERVER-ONLY. Two jobs, run
// from the same cron as M2 broadcasts:
//   1. evaluateAutomations()      — for each active automation, find the
//      contacts that just became due and enqueue a send into automation_sends
//      (the outbox). Idempotent: every enqueue carries a dedup_key and inserts
//      ON CONFLICT DO NOTHING, so the once-a-minute evaluator never resends.
//   2. dispatchDueAutomationSends() — drain pending sends via Resend (email) /
//      Twilio (SMS), exactly like the broadcast dispatcher.
//
// Triggers:
//   * post_visit — a thank-you sent `delay_days` after a check-in (per visit).
//   * win_back   — a "we miss you" when a contact's last visit was `delay_days`
//      ago (per lapse episode, keyed to the last-visit date so a contact who
//      returns and lapses again can be re-won-back, but a still-gone contact is
//      messaged only once).
//
// A "visit" is a signed, live-mode waiver (the check-in anchor). Test-mode
// check-ins never create contacts and are excluded here too.

import { createAdminClient } from '@/lib/supabase-admin'
import { sendMarketingEmail } from '@/lib/email'
import { sendSms, smsConfigured } from '@/lib/sms'
import { fetchBranding } from '@/lib/branding'
import { participantBaseUrl } from '@/lib/participant-url'

type AdminClient = ReturnType<typeof createAdminClient>

const DAY_MS = 24 * 60 * 60 * 1000
// How far back past the due edge post_visit still looks, so a missed cron run
// (or an operator enabling it mid-day) doesn't skip recent visits. Dedup makes
// a wider window harmless — a visit is still enqueued at most once.
const POST_VISIT_LOOKBACK_DAYS = 2
const ENQUEUE_SCAN_LIMIT = 5000   // modest built-in; large audiences go 3rd-party

interface AutomationRow {
  id: string; operator_id: string; trigger: 'post_visit' | 'win_back'
  channel: 'email' | 'sms'; subject: string | null; body: string; delay_days: number
}
interface ContactRow {
  id: string; participant_id: string | null; email: string; phone: string | null
  full_name: string | null; unsubscribe_token: string
}
interface PendingSend {
  automation_id: string; operator_id: string; contact_id: string; participant_id: string | null
  trigger: string; channel: 'email' | 'sms'; to_address: string; to_name: string | null
  unsubscribe_token: string; dedup_key: string
}

function unsubscribeUrl(token: string, channel: 'email' | 'sms'): string {
  const base = participantBaseUrl() || ''
  return `${base}/unsubscribe/${token}${channel === 'sms' ? '?c=sms' : ''}`
}

function firstName(fullName: string | null | undefined): string {
  const n = (fullName ?? '').trim().split(/\s+/)[0]
  return n || 'there'
}

/** Fill a small, safe set of merge tokens in operator-authored copy. */
export function renderTemplate(text: string, vars: { firstName: string; business: string }): string {
  return text
    .replace(/\{\{\s*first_name\s*\}\}/gi, vars.firstName)
    .replace(/\{\{\s*business\s*\}\}/gi, vars.business)
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Opted-in, non-unsubscribed contacts for a channel that actually have an
 *  address to send to. Shared by both triggers. */
async function optedInContacts(admin: AdminClient, operatorId: string, channel: 'email' | 'sms'): Promise<ContactRow[]> {
  const sel = admin.from('marketing_contacts')
    .select('id, participant_id, email, phone, full_name, unsubscribe_token')
    .eq('operator_id', operatorId)
    .limit(ENQUEUE_SCAN_LIMIT)
  const { data } = channel === 'email'
    ? await sel.eq('email_consent', true).is('unsubscribed_email_at', null)
    : await sel.eq('sms_consent', true).is('unsubscribed_sms_at', null).not('phone', 'is', null)
  return ((data ?? []) as ContactRow[]).filter(c => channel === 'email' ? !!c.email : !!c.phone)
}

function makeSend(a: AutomationRow, c: ContactRow, dedupKey: string): PendingSend {
  return {
    automation_id: a.id, operator_id: a.operator_id, contact_id: c.id, participant_id: c.participant_id,
    trigger: a.trigger, channel: a.channel,
    to_address: (a.channel === 'email' ? c.email : c.phone) as string,
    to_name: c.full_name, unsubscribe_token: c.unsubscribe_token, dedup_key: dedupKey,
  }
}

/** Insert new sends, skipping any whose dedup_key already exists. Returns the
 *  number newly enqueued. */
async function enqueue(admin: AdminClient, rows: PendingSend[]): Promise<number> {
  if (rows.length === 0) return 0
  const { data, error } = await admin
    .from('automation_sends')
    .upsert(rows, { onConflict: 'dedup_key', ignoreDuplicates: true })
    .select('id')
  if (error) return 0
  return (data ?? []).length
}

async function enqueuePostVisit(admin: AdminClient, a: AutomationRow, now: Date): Promise<number> {
  // Visits that became due since the last look: signed between
  // now-(delay+lookback) and now-delay.
  const upper = new Date(now.getTime() - a.delay_days * DAY_MS)
  const lower = new Date(upper.getTime() - POST_VISIT_LOOKBACK_DAYS * DAY_MS)
  const { data: waivers } = await admin
    .from('waivers')
    .select('id, participant_id, signed_at')
    .eq('operator_id', a.operator_id)
    .eq('mode', 'live')
    .not('signed_at', 'is', null)
    .gte('signed_at', lower.toISOString())
    .lt('signed_at', upper.toISOString())
    .limit(ENQUEUE_SCAN_LIMIT)
  const visits = (waivers ?? []) as { id: string; participant_id: string | null }[]
  if (visits.length === 0) return 0

  // Map each visiting participant to their opted-in contact.
  const contacts = await optedInContacts(admin, a.operator_id, a.channel)
  const byParticipant = new Map<string, ContactRow>()
  for (const c of contacts) if (c.participant_id) byParticipant.set(c.participant_id, c)

  const rows: PendingSend[] = []
  for (const v of visits) {
    if (!v.participant_id) continue
    const c = byParticipant.get(v.participant_id)
    if (!c) continue
    rows.push(makeSend(a, c, `pv:${a.id}:${v.id}`))
  }
  return enqueue(admin, rows)
}

async function enqueueWinBack(admin: AdminClient, a: AutomationRow, now: Date): Promise<number> {
  const contacts = await optedInContacts(admin, a.operator_id, a.channel)
  if (contacts.length === 0) return 0

  // Last live visit per participant, in one scan.
  const { data: waivers } = await admin
    .from('waivers')
    .select('participant_id, signed_at')
    .eq('operator_id', a.operator_id)
    .eq('mode', 'live')
    .not('signed_at', 'is', null)
    .order('signed_at', { ascending: false })
    .limit(ENQUEUE_SCAN_LIMIT)
  const lastVisit = new Map<string, string>()   // participant_id -> latest signed_at (ISO)
  for (const w of (waivers ?? []) as { participant_id: string | null; signed_at: string }[]) {
    if (w.participant_id && !lastVisit.has(w.participant_id)) lastVisit.set(w.participant_id, w.signed_at)
  }

  const cutoff = new Date(now.getTime() - a.delay_days * DAY_MS)
  const rows: PendingSend[] = []
  for (const c of contacts) {
    if (!c.participant_id) continue
    const last = lastVisit.get(c.participant_id)
    if (!last) continue                         // no recorded visit — nothing to win back
    const lastDate = new Date(last)
    if (lastDate > cutoff) continue             // visited within the window — not lapsed
    // Once per lapse episode: keyed to the last-visit day.
    rows.push(makeSend(a, c, `wb:${a.id}:${c.id}:${ymd(lastDate)}`))
  }
  return enqueue(admin, rows)
}

/** Enqueue everything due right now. Safe to run every minute. */
export async function evaluateAutomations(admin: AdminClient, opts?: { now?: Date }): Promise<{ enqueued: number }> {
  const now = opts?.now ?? new Date()
  const { data: autos } = await admin
    .from('automations')
    .select('id, operator_id, trigger, channel, subject, body, delay_days')
    .eq('active', true)
  let enqueued = 0
  for (const a of (autos ?? []) as AutomationRow[]) {
    if (!a.body || a.body.trim().length === 0) continue
    if (a.channel === 'sms' && !smsConfigured()) continue     // don't pile sends that must fail
    if (a.channel === 'email' && !a.subject?.trim()) continue
    enqueued += a.trigger === 'post_visit'
      ? await enqueuePostVisit(admin, a, now)
      : await enqueueWinBack(admin, a, now)
  }
  return { enqueued }
}

interface DueRow {
  id: string; automation_id: string; channel: 'email' | 'sms'; to_address: string
  to_name: string | null; unsubscribe_token: string
}
interface AutoMeta {
  operator_id: string; subject: string | null; body: string
  operatorName: string; logoUrl: string | null; primaryColor: string | null
}

/** Drain up to `limit` pending automation sends via Resend / Twilio. Mirrors
 *  the broadcast dispatcher: per-automation content + brand cached once. */
export async function dispatchDueAutomationSends(admin: AdminClient, limit = 50): Promise<{
  attempted: number; sent: number; failed: number
}> {
  const { data: due } = await admin
    .from('automation_sends')
    .select('id, automation_id, channel, to_address, to_name, unsubscribe_token')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  const sends = (due ?? []) as DueRow[]
  const summary = { attempted: 0, sent: 0, failed: 0 }
  if (sends.length === 0) return summary

  const metaCache = new Map<string, AutoMeta | null>()
  async function metaFor(automationId: string): Promise<AutoMeta | null> {
    if (metaCache.has(automationId)) return metaCache.get(automationId)!
    const { data: a } = await admin
      .from('automations').select('operator_id, subject, body').eq('id', automationId).maybeSingle()
    if (!a) { metaCache.set(automationId, null); return null }
    const [{ data: op }, branding] = await Promise.all([
      admin.from('operators').select('name').eq('id', a.operator_id).maybeSingle(),
      fetchBranding(admin, a.operator_id),
    ])
    const meta: AutoMeta = {
      operator_id: a.operator_id, subject: a.subject, body: a.body,
      operatorName: op?.name ?? 'Us', logoUrl: branding.logoUrl, primaryColor: branding.primaryColor,
    }
    metaCache.set(automationId, meta)
    return meta
  }

  for (const s of sends) {
    const meta = await metaFor(s.automation_id)
    if (!meta) {
      await admin.from('automation_sends').update({ status: 'failed', error: 'automation missing' }).eq('id', s.id)
      summary.attempted++; summary.failed++
      continue
    }
    summary.attempted++
    const vars = { firstName: firstName(s.to_name), business: meta.operatorName }
    try {
      let providerId = ''
      if (s.channel === 'email') {
        const r = await sendMarketingEmail({
          to: s.to_address,
          subject: renderTemplate(meta.subject || meta.operatorName, vars),
          body: renderTemplate(meta.body, vars),
          operatorName: meta.operatorName,
          unsubscribeUrl: unsubscribeUrl(s.unsubscribe_token, 'email'),
          logoUrl: meta.logoUrl, primaryColor: meta.primaryColor,
        })
        providerId = r.id
      } else {
        const base = renderTemplate(meta.body, vars)
        const text = /stop/i.test(base) ? base : `${base}\n\nReply STOP to opt out.`
        const r = await sendSms(s.to_address, text)
        providerId = r.sid
      }
      await admin.from('automation_sends').update({ status: 'sent', provider_id: providerId, sent_at: new Date().toISOString() }).eq('id', s.id)
      summary.sent++
    } catch (e) {
      await admin.from('automation_sends').update({ status: 'failed', error: e instanceof Error ? e.message : 'send failed' }).eq('id', s.id)
      summary.failed++
    }
  }

  return summary
}
