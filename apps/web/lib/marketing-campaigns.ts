// lib/marketing-campaigns.ts
// Marketing automation — M2 broadcast engine. SERVER-ONLY. Two jobs:
//   1. createCampaign() — snapshot the opted-in audience for a channel into
//      campaign_sends (the outbox). Recipients are frozen at send time.
//   2. dispatchDueCampaignSends() — the cron dispatcher: drain pending sends,
//      send each via Resend (email) / Twilio (SMS), record the outcome, and
//      finalize the campaign when its outbox is drained.
// Built-in stays "basic": a per-run cap keeps volume modest; large sends go to
// a 3rd-party platform via the contacts API.

import { createAdminClient } from '@/lib/supabase-admin'
import { sendMarketingEmail } from '@/lib/email'
import { sendSms, smsConfigured } from '@/lib/sms'
import { fetchBranding } from '@/lib/branding'
import { participantBaseUrl } from '@/lib/participant-url'

type AdminClient = ReturnType<typeof createAdminClient>

export interface CreateCampaignInput {
  operatorId: string
  name: string
  channel: 'email' | 'sms'
  subject?: string | null
  body: string
  createdBy?: string | null
}

export type CreateCampaignOutcome =
  | { campaignId: string; audienceCount: number }
  | { error: string }

function unsubscribeUrl(token: string): string {
  const base = participantBaseUrl() || ''
  return `${base}/unsubscribe/${token}`
}

/** Create a campaign and snapshot its recipients into the outbox. */
export async function createCampaign(admin: AdminClient, input: CreateCampaignInput): Promise<CreateCampaignOutcome> {
  const name = input.name.trim()
  const body = input.body.trim()
  if (!name) return { error: 'A campaign name is required.' }
  if (!body) return { error: 'A message body is required.' }
  if (input.channel === 'email' && !input.subject?.trim()) return { error: 'An email subject is required.' }
  if (input.channel === 'sms' && !smsConfigured()) return { error: 'SMS is not configured yet (Twilio credentials + a registered 10DLC campaign are required).' }

  // Snapshot the opted-in, non-unsubscribed audience for this channel.
  const sel = admin.from('marketing_contacts')
    .select('id, email, phone, unsubscribe_token')
    .eq('operator_id', input.operatorId)
  const { data: contacts, error: cErr } = input.channel === 'email'
    ? await sel.eq('email_consent', true).is('unsubscribed_email_at', null)
    : await sel.eq('sms_consent', true).is('unsubscribed_sms_at', null).not('phone', 'is', null)
  if (cErr) return { error: cErr.message }

  const recipients = (contacts ?? []).filter(c => input.channel === 'email' ? !!c.email : !!c.phone)
  if (recipients.length === 0) return { error: 'No opted-in contacts for this channel yet.' }

  const { data: campaign, error: campErr } = await admin
    .from('campaigns')
    .insert({
      operator_id: input.operatorId, name, channel: input.channel,
      subject: input.channel === 'email' ? input.subject!.trim() : null,
      body, status: 'queued', audience_count: recipients.length, created_by: input.createdBy ?? null,
    })
    .select('id').single()
  if (campErr || !campaign) return { error: campErr?.message || 'Failed to create campaign.' }

  const sends = recipients.map(c => ({
    campaign_id: campaign.id, operator_id: input.operatorId, contact_id: c.id, channel: input.channel,
    to_address: (input.channel === 'email' ? c.email : c.phone) as string,
    unsubscribe_token: c.unsubscribe_token, status: 'pending',
  }))
  const { error: sErr } = await admin.from('campaign_sends').insert(sends)
  if (sErr) return { error: sErr.message }

  return { campaignId: campaign.id, audienceCount: recipients.length }
}

interface SendRow {
  id: string; campaign_id: string; channel: 'email' | 'sms'; to_address: string; unsubscribe_token: string
}
interface CampaignMeta {
  operator_id: string; subject: string | null; body: string
  operatorName: string; logoUrl: string | null; primaryColor: string | null
}

/**
 * Drain up to `limit` pending sends. Loads each referenced campaign's content
 * + the operator's brand once (cached), sends each message, and records the
 * result. Finalizes every touched campaign whose outbox is now empty.
 */
export async function dispatchDueCampaignSends(admin: AdminClient, limit = 50): Promise<{
  attempted: number; sent: number; failed: number
}> {
  const { data: due } = await admin
    .from('campaign_sends')
    .select('id, campaign_id, channel, to_address, unsubscribe_token')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  const sends = (due ?? []) as SendRow[]
  const summary = { attempted: 0, sent: 0, failed: 0 }
  if (sends.length === 0) return summary

  const metaCache = new Map<string, CampaignMeta | null>()
  const touched = new Set<string>()

  async function metaFor(campaignId: string): Promise<CampaignMeta | null> {
    if (metaCache.has(campaignId)) return metaCache.get(campaignId)!
    const { data: c } = await admin.from('campaigns').select('operator_id, subject, body').eq('id', campaignId).maybeSingle()
    if (!c) { metaCache.set(campaignId, null); return null }
    const [{ data: op }, branding] = await Promise.all([
      admin.from('operators').select('name').eq('id', c.operator_id).maybeSingle(),
      fetchBranding(admin, c.operator_id),
    ])
    const meta: CampaignMeta = {
      operator_id: c.operator_id, subject: c.subject, body: c.body,
      operatorName: op?.name ?? 'Us', logoUrl: branding.logoUrl, primaryColor: branding.primaryColor,
    }
    metaCache.set(campaignId, meta)
    return meta
  }

  for (const s of sends) {
    touched.add(s.campaign_id)
    const meta = await metaFor(s.campaign_id)
    if (!meta) {
      await admin.from('campaign_sends').update({ status: 'failed', error: 'campaign missing' }).eq('id', s.id)
      summary.attempted++; summary.failed++
      continue
    }
    summary.attempted++
    try {
      let providerId = ''
      if (s.channel === 'email') {
        const r = await sendMarketingEmail({
          to: s.to_address, subject: meta.subject || meta.operatorName, body: meta.body,
          operatorName: meta.operatorName, unsubscribeUrl: unsubscribeUrl(s.unsubscribe_token),
          logoUrl: meta.logoUrl, primaryColor: meta.primaryColor,
        })
        providerId = r.id
      } else {
        const text = /stop/i.test(meta.body) ? meta.body : `${meta.body}\n\nReply STOP to opt out.`
        const r = await sendSms(s.to_address, text)
        providerId = r.sid
      }
      await admin.from('campaign_sends').update({ status: 'sent', provider_id: providerId, sent_at: new Date().toISOString() }).eq('id', s.id)
      summary.sent++
    } catch (e) {
      await admin.from('campaign_sends').update({ status: 'failed', error: e instanceof Error ? e.message : 'send failed' }).eq('id', s.id)
      summary.failed++
    }
  }

  // Finalize each touched campaign whose outbox is now drained.
  for (const campaignId of Array.from(touched)) {
    const { count: pending } = await admin.from('campaign_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'pending')
    const { count: sent } = await admin.from('campaign_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'sent')
    const { count: failed } = await admin.from('campaign_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'failed')
    const patch: Record<string, unknown> = { sent_count: sent ?? 0, failed_count: failed ?? 0 }
    if ((pending ?? 0) === 0) {
      patch.status = (sent ?? 0) > 0 ? 'sent' : 'failed'
      patch.sent_at = new Date().toISOString()
    } else {
      patch.status = 'sending'
    }
    await admin.from('campaigns').update(patch).eq('id', campaignId)
  }

  return summary
}
