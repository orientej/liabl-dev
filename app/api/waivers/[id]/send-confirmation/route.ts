// app/api/waivers/[id]/send-confirmation/route.ts
// v25 M6 security review — sends the waiver confirmation email
// StepConfirm.tsx has always claimed happens, but never actually did.
//
// Deliberately takes only a waiverId, not participant name/email/activity
// directly — those are looked up server-side via the admin client. If
// this took client-supplied content instead, anyone could call it
// directly to send arbitrary LIABL-branded email to arbitrary addresses,
// using this app's sending reputation for spam or phishing. Requiring a
// real, already-signed waiver row ties every email this route can send
// to something that actually happened.
//
// Uses the admin (service-role) client rather than the caller's session
// because the caller here is the anonymous participant flow — the same
// participant who has no ongoing SELECT access to the waivers table by
// RLS design (see 011_m5_rls_tighten.sql). This route needs to read the
// waiver it just created regardless, which is exactly the kind of
// narrow, legitimate system operation the service-role client is for —
// it does not accept or trust anything else from the request body.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendWaiverConfirmationEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const waiverId = params.id
  if (!waiverId) {
    return NextResponse.json({ error: 'Missing waiver id' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: waiver, error } = await supabase
    .from('waivers')
    .select('id, signed_at, activity_key, operator_id, participants(full_name, email)')
    .eq('id', waiverId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: `waiver lookup: ${error.message}` }, { status: 500 })
  }
  if (!waiver || !waiver.signed_at) {
    // Not found, or exists but isn't actually signed yet — either way,
    // nothing to confirm. Not an error state worth alarming over; this
    // can legitimately happen if sealing failed after the waiver row was
    // created (see ParticipantFlow.tsx's attemptSave, which only fires
    // this route after full success).
    return NextResponse.json({ sent: false, reason: 'waiver not found or not signed' }, { status: 404 })
  }

  const participant = Array.isArray(waiver.participants) ? waiver.participants[0] : waiver.participants
  if (!participant?.email) {
    return NextResponse.json({ sent: false, reason: 'no participant email on file' }, { status: 404 })
  }

  const [{ data: operator }, { data: activity }] = await Promise.all([
    supabase.from('operators').select('name').eq('id', waiver.operator_id).maybeSingle(),
    supabase.from('activities').select('display_name').eq('operator_id', waiver.operator_id).eq('key', waiver.activity_key).maybeSingle(),
  ])

  try {
    await sendWaiverConfirmationEmail({
      to:              participant.email,
      participantName: participant.full_name ?? 'there',
      operatorName:    operator?.name ?? 'the operator',
      activityLabel:   activity?.display_name ?? waiver.activity_key,
      signedAt:        waiver.signed_at,
    })
  } catch (sendError) {
    // Email delivery is best-effort from the participant's perspective —
    // their waiver is already validly signed and sealed regardless of
    // whether this confirmation email succeeds. Surface the failure in
    // the response for logging/monitoring, but this was already called
    // fire-and-forget from ParticipantFlow.tsx, so nothing in the UI
    // blocks on it.
    return NextResponse.json(
      { sent: false, error: sendError instanceof Error ? sendError.message : 'send failed' },
      { status: 502 }
    )
  }

  return NextResponse.json({ sent: true })
}
