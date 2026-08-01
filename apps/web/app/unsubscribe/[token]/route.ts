// app/unsubscribe/[token]/route.ts
// Marketing automation — M2 public unsubscribe. The link in every marketing
// email points here. GET unsubscribes the channel (email by default, `?c=sms`
// for text) using the contact's unguessable token and shows a confirmation
// page. Service-role (no session — the recipient isn't a user); it only ever
// flips a suppression timestamp on the row the token identifies, so it can't
// touch anything else. Honors the one-click List-Unsubscribe-Post too.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function page(operatorName: string, channel: string, ok: boolean): string {
  const what = channel === 'sms' ? 'text messages' : 'marketing emails'
  const msg = ok
    ? `You've been unsubscribed from ${operatorName} ${what}. You won't receive any more.`
    : `This unsubscribe link is invalid or has already been used.`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribe</title>
    <style>body{font-family:-apple-system,sans-serif;background:#F7F6F2;color:#0D0E12;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
    .card{background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:16px;padding:32px;max-width:420px;margin:16px;text-align:center}
    h1{font-size:20px;margin:0 0 8px}p{font-size:14px;color:#555;line-height:1.5;margin:0}</style></head>
    <body><div class="card"><h1>${ok ? 'Unsubscribed' : 'Link not found'}</h1><p>${msg}</p></div></body></html>`
}

async function unsubscribe(token: string, channel: 'email' | 'sms'): Promise<{ ok: boolean; operatorName: string }> {
  const admin = createAdminClient()
  const { data: contact } = await admin
    .from('marketing_contacts').select('id, operator_id').eq('unsubscribe_token', token).maybeSingle()
  if (!contact) return { ok: false, operatorName: 'this business' }
  const now = new Date().toISOString()
  const patch = channel === 'sms' ? { unsubscribed_sms_at: now } : { unsubscribed_email_at: now }
  await admin.from('marketing_contacts').update({ ...patch, updated_at: now }).eq('id', contact.id)
  const { data: op } = await admin.from('operators').select('name').eq('id', contact.operator_id).maybeSingle()
  return { ok: true, operatorName: op?.name ?? 'this business' }
}

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const channel = new URL(request.url).searchParams.get('c') === 'sms' ? 'sms' : 'email'
  const { ok, operatorName } = await unsubscribe(params.token, channel)
  return new NextResponse(page(operatorName, channel, ok), { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

// One-click (RFC 8058): mail clients POST here to unsubscribe without opening.
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const channel = new URL(request.url).searchParams.get('c') === 'sms' ? 'sms' : 'email'
  await unsubscribe(params.token, channel)
  return new NextResponse(null, { status: 204 })
}
