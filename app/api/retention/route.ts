// app/api/retention/route.ts
// v25 M5 — 90-day document retention enforcement.
//
// Redacts (does not fully delete) waivers signed more than 90 days ago
// with no active legal hold: nulls out health answers, rendered clause
// text (which has the participant's name baked into it, not just
// template content), signature image, IP address, and the sealed PDF's
// URL — and separately deletes the actual PDF file from Storage, since
// nulling the DB column alone would leave the file itself orphaned
// there. Keeps a minimal stub (participant/session/activity linkage,
// signed date, is_minor/guardian_name, risk_score/risk_level,
// document_hash) — see 014_m5_retention.sql for the full reasoning.
//
// Protected by CRON_SECRET, matching Vercel Cron Jobs' recommended
// pattern: set CRON_SECRET in the project's environment variables, and
// Vercel's scheduler sends it as a Bearer token automatically. Anyone
// else calling this route without that header gets rejected — this is
// a destructive, cross-operator administrative operation and must not
// be publicly triggerable.
//
// This route intentionally forces Node.js runtime (not Edge) since the
// service-role Supabase client isn't verified Edge-compatible, and
// forces dynamic rendering for the same reason /api/roster needed it —
// there's no request signal here either for Next's static analysis to
// key off, and this must never be prerendered at build time.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RETENTION_DAYS = 90

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

  const { data: candidates, error: fetchError } = await supabase
    .from('waivers')
    .select('id, signed_at')
    .lt('signed_at', cutoff.toISOString())
    .eq('legal_hold', false)
    .is('redacted_at', null)
    .not('signed_at', 'is', null)

  if (fetchError) {
    return NextResponse.json({ error: `fetch candidates: ${fetchError.message}` }, { status: 500 })
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ redacted: 0, storageErrors: [] })
  }

  const storageErrors: { waiverId: string; error: string }[] = []
  const redactedIds: string[] = []

  for (const waiver of candidates) {
    // Path is fully deterministic from data we already have — see
    // lib/seal.ts's uploadPdf — computed directly rather than read from
    // pdf_path (which this migration-era code predates using directly;
    // as of 015_m6_pdf_path.sql, pdf_path stores this same value, but
    // recomputing it here doesn't depend on that column being populated
    // for older rows). Mirrors uploadPdf's exact getFullYear()/getMonth()
    // calls (not UTC variants) — matching the original write path
    // precisely rather than assuming they're equivalent in whatever
    // runtime this executes in.
    const signedAt = new Date(waiver.signed_at as string)
    const yyyy = signedAt.getFullYear()
    const mm   = String(signedAt.getMonth() + 1).padStart(2, '0')
    const path = `waivers/${yyyy}/${mm}/${waiver.id}.pdf`

    const { error: storageError } = await supabase.storage.from('waivers').remove([path])
    if (storageError) {
      // Don't skip the DB redaction over a storage error (e.g. the file
      // was already removed by hand) — but do surface it rather than
      // silently proceeding as if the PDF is definitely gone.
      storageErrors.push({ waiverId: waiver.id, error: storageError.message })
    }

    const { error: updateError } = await supabase
      .from('waivers')
      .update({
        answers:        null,
        clauses:        null,
        signature_data: null,
        pdf_path:       null,
        ip_address:     null,
        redacted_at:    new Date().toISOString(),
      })
      .eq('id', waiver.id)

    if (updateError) {
      storageErrors.push({ waiverId: waiver.id, error: `db update: ${updateError.message}` })
      continue
    }

    redactedIds.push(waiver.id)
  }

  return NextResponse.json({ redacted: redactedIds.length, redactedIds, storageErrors })
}
