// lib/marketing-client.ts
// Marketing automation — M1 console helpers. Client-safe (browser client,
// RLS-scoped). Lists the operator's opted-in contacts and toggles the
// operator's marketing_enabled flag. No secrets, no crypto.

import { createClient } from '@/lib/supabase'

export interface MarketingContact {
  email:            string
  phone:            string | null
  fullName:         string | null
  emailConsent:     boolean
  smsConsent:       boolean
  emailConsentAt:   string | null
  smsConsentAt:     string | null
  unsubscribedEmail: boolean
  unsubscribedSms:  boolean
  createdAt:        string
}

export async function setMarketingEnabled(operatorId: string, enabled: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('operators').update({ marketing_enabled: enabled }).eq('id', operatorId)
  if (error) throw new Error(`update marketing setting: ${error.message}`)
}

export async function listMarketingContacts(operatorId: string): Promise<MarketingContact[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('marketing_contacts')
    .select('email, phone, full_name, email_consent, sms_consent, email_consent_at, sms_consent_at, unsubscribed_email_at, unsubscribed_sms_at, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`list contacts: ${error.message}`)
  return (data ?? []).map(c => ({
    email: c.email, phone: c.phone ?? null, fullName: c.full_name ?? null,
    emailConsent: c.email_consent, smsConsent: c.sms_consent,
    emailConsentAt: c.email_consent_at ?? null, smsConsentAt: c.sms_consent_at ?? null,
    unsubscribedEmail: !!c.unsubscribed_email_at, unsubscribedSms: !!c.unsubscribed_sms_at,
    createdAt: c.created_at,
  }))
}

/** A CSV of opted-in contacts (active consent only) for a manual export. */
export function contactsToCsv(contacts: MarketingContact[]): string {
  const header = ['email', 'phone', 'full_name', 'email_consent', 'sms_consent', 'created_at']
  const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  const rows = contacts
    .filter(c => (c.emailConsent && !c.unsubscribedEmail) || (c.smsConsent && !c.unsubscribedSms))
    .map(c => [
      c.email, c.phone ?? '', c.fullName ?? '',
      String(c.emailConsent && !c.unsubscribedEmail), String(c.smsConsent && !c.unsubscribedSms), c.createdAt,
    ].map(v => esc(String(v))).join(','))
  return [header.join(','), ...rows].join('\n')
}

export interface CampaignRecord {
  id:            string
  name:          string
  channel:       'email' | 'sms'
  subject:       string | null
  status:        string
  audienceCount: number
  sentCount:     number
  failedCount:   number
  sentAt:        string | null
  createdAt:     string
}

export async function listCampaigns(operatorId: string): Promise<CampaignRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name, channel, subject, status, audience_count, sent_count, failed_count, sent_at, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`list campaigns: ${error.message}`)
  return (data ?? []).map(c => ({
    id: c.id, name: c.name, channel: c.channel, subject: c.subject ?? null, status: c.status,
    audienceCount: c.audience_count, sentCount: c.sent_count, failedCount: c.failed_count,
    sentAt: c.sent_at ?? null, createdAt: c.created_at,
  }))
}
