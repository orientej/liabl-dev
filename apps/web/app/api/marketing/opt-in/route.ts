// app/api/marketing/opt-in/route.ts
// Marketing automation — M1. Called (fire-and-forget) from the participant
// flow right after a check-in when the participant ticked a marketing opt-in.
// Service-role: marketing_contacts has no anon policy (it's PII), so the
// anonymous participant can't write it directly — this narrow route does,
// deriving the operator + mode from the just-created waiver so the caller
// can't target another operator or forge consent for an arbitrary row.
//
//   POST { waiverId, email, phone?, fullName?, emailConsent, smsConsent }
//
// Test-mode check-ins do NOT create marketing contacts (sandbox stays clean).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { recordMarketingOptIn } from '@/lib/marketing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { waiverId, email } = body as { waiverId?: string; email?: string }
  const emailConsent = !!body.emailConsent
  const smsConsent = !!body.smsConsent

  if (!waiverId || !email) return NextResponse.json({ error: 'Missing waiverId or email' }, { status: 400 })
  // Nothing to record if the participant opted into neither channel.
  if (!emailConsent && !smsConsent) return NextResponse.json({ ok: true, note: 'no consent given' })

  const admin = createAdminClient()

  // Derive operator + mode from the waiver — never trust the body for those.
  const { data: waiver } = await admin
    .from('waivers')
    .select('operator_id, mode, participant_id')
    .eq('id', waiverId)
    .maybeSingle()
  if (!waiver?.operator_id) return NextResponse.json({ error: 'Waiver not found' }, { status: 404 })
  if (waiver.mode === 'test') return NextResponse.json({ ok: true, note: 'test mode — skipped' })

  try {
    await recordMarketingOptIn(admin, {
      operatorId: waiver.operator_id,
      email,
      phone: (body.phone as string | undefined) ?? null,
      fullName: (body.fullName as string | undefined) ?? null,
      participantId: waiver.participant_id ?? null,
      emailConsent,
      smsConsent,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    // Opt-in is best-effort from the participant's perspective — their waiver
    // is already signed. Surface the error for monitoring, don't block the UI.
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'opt-in failed' }, { status: 502 })
  }
}
