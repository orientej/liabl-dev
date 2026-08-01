// app/api/marketing/sms-inbound/route.ts
// Marketing automation — M2 Twilio inbound webhook. Twilio POSTs incoming SMS
// here (configure this URL on the Messaging Service). We mirror STOP/START
// into our own suppression list so the dispatcher never targets a stopped
// number. NOTE: Twilio's Advanced Opt-Out already enforces STOP at the carrier
// level regardless of this handler — this keeps our DB in sync for reporting
// and pre-send filtering.
//
// Verified via the X-Twilio-Signature header (see lib/sms). Returns empty TwiML.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { verifyTwilioSignature, classifyInboundSms } from '@/lib/sms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TWIML_OK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>

  // Reconstruct the exact URL Twilio signed (scheme + host + path; no query).
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const signedUrl = process.env.TWILIO_SMS_WEBHOOK_URL || `${proto}://${host}${new URL(request.url).pathname}`

  if (!verifyTwilioSignature(signedUrl, params, request.headers.get('x-twilio-signature'))) {
    return new NextResponse('forbidden', { status: 403 })
  }

  const from = (params.From || '').trim()
  const kind = classifyInboundSms(params.Body || '')
  if (from && (kind === 'stop' || kind === 'start')) {
    const admin = createAdminClient()
    const patch = kind === 'stop'
      ? { unsubscribed_sms_at: new Date().toISOString() }
      : { unsubscribed_sms_at: null }
    // Best-effort match on the stored phone. Twilio enforces STOP regardless;
    // this keeps our list accurate for pre-send filtering + reporting.
    await admin.from('marketing_contacts').update({ ...patch, updated_at: new Date().toISOString() }).eq('phone', from).then(() => {}, () => {})
  }

  return new NextResponse(TWIML_OK, { headers: { 'content-type': 'text/xml' } })
}
