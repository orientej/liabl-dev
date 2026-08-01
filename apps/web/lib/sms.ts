// lib/sms.ts
// Marketing automation — M2 SMS via Twilio. SERVER-ONLY (Twilio auth token
// must never reach the browser). Sends through a Messaging Service (preferred,
// for 10DLC + STOP handling) or a single From number, and verifies inbound
// webhook signatures so only Twilio can post STOP notices to us.
//
// Env (set by Joe): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and one of
// TWILIO_MESSAGING_SERVICE_SID (recommended) or TWILIO_FROM_NUMBER.

import crypto from 'crypto'

export function smsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER))
}

/** Send one SMS. Throws on a Twilio error (the caller records it on the send). */
export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) throw new Error('Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).')

  const params = new URLSearchParams()
  params.set('To', to)
  params.set('Body', body)
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID)
  else if (process.env.TWILIO_FROM_NUMBER) params.set('From', process.env.TWILIO_FROM_NUMBER)
  else throw new Error('Twilio sender not configured (TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER).')

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || `Twilio ${res.status}`)
  return { sid: data.sid as string }
}

/**
 * Verify a Twilio inbound webhook signature (X-Twilio-Signature): base64
 * HMAC-SHA1 over the full request URL + each POST param appended as key+value
 * in alphabetical key order, keyed by the auth token. Constant-time compare.
 */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token || !signature) return false
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('')
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf8')).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Carrier-standard opt-out / opt-in keywords (Twilio handles these at the
// Messaging Service level too; we mirror them to keep our own suppression
// list accurate so the dispatcher never targets a stopped number).
const STOP_WORDS  = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'])
const START_WORDS = new Set(['start', 'unstop', 'yes'])

export function classifyInboundSms(body: string): 'stop' | 'start' | 'other' {
  const w = body.trim().toLowerCase()
  if (STOP_WORDS.has(w)) return 'stop'
  if (START_WORDS.has(w)) return 'start'
  return 'other'
}
