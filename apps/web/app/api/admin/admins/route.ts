// app/api/admin/admins/route.ts
// v25 Global Admin Console — manage who has global admin access.
//
// Adding an admin by email has three real cases, handled in order:
// 1. Already a liabl_admin — rejected with a clear message, not a
//    confusing duplicate-key error.
// 2. Email already has operator access (operator_members) — the case
//    explicitly asked for: one login can be both an operator member AND
//    a global admin, since the two tables are independent with no
//    mutual exclusion. Fast path: operator_members already has a
//    denormalized email column, so this is a direct lookup, not a scan
//    through every auth user.
// 3. Genuinely new — no existing account at all. Uses
//    supabase.auth.admin.inviteUserByEmail(), which sends a real
//    magic-link email and creates the account only once they click it.
//    Deliberately NOT a generated password handed back through this API
//    or the admin UI — a password that transits a server response is a
//    password that shouldn't exist.
//
// One edge case case 3 can still hit: an auth.users row that exists but
// isn't in operator_members (e.g. someone who started operator signup
// and never finished org setup). inviteUserByEmail will fail for an
// existing email, so a bounded listUsers() scan is the fallback there —
// GoTrue's admin API has no server-side "find by email" filter in the
// installed SDK version, so this is a paginated scan, not a targeted
// query. Bounded at 1000 users, which comfortably covers this app's
// realistic scale; if it's not found within that, the error says so
// plainly rather than silently failing.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import type { User } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const client = createAdminClient()
  const { data: admins, error } = await client
    .from('liabl_admins')
    .select('id, user_id, email, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For each admin, note whether they ALSO have operator access — a
  // direct, visible confirmation in the UI that the two are independent
  // and can coexist, not just something asserted in a comment.
  const { data: memberRows } = await client
    .from('operator_members')
    .select('user_id, role, operators(name)')

  const operatorByUserId = new Map<string, { role: string; operatorName: string }>()
  for (const row of memberRows ?? []) {
    const operator = Array.isArray(row.operators) ? row.operators[0] : row.operators
    operatorByUserId.set(row.user_id, { role: row.role, operatorName: operator?.name ?? 'Unknown' })
  }

  const result = (admins ?? []).map(a => ({
    ...a,
    alsoOperatorMember: operatorByUserId.get(a.user_id) ?? null,
  }))

  return NextResponse.json({ admins: result })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { email: rawEmail } = await request.json()
  const email = String(rawEmail ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const client = createAdminClient()

  const { data: existingAdmin } = await client.from('liabl_admins').select('id').eq('email', email).maybeSingle()
  if (existingAdmin) {
    return NextResponse.json({ error: 'This email already has admin access.' }, { status: 409 })
  }

  // Case 2: fast path via operator_members' denormalized email.
  const { data: existingMember } = await client
    .from('operator_members')
    .select('user_id, operators(name)')
    .eq('email', email)
    .maybeSingle()

  if (existingMember) {
    const { error: insertError } = await client
      .from('liabl_admins')
      .insert({ user_id: existingMember.user_id, email })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    await logAdminAction(admin, {
      actionType: 'admin_added',
      targetUserId: existingMember.user_id,
      metadata: { email, via: 'existing_operator_account' },
    })
    return NextResponse.json({ added: true, via: 'existing_operator_account' })
  }

  // Case 3: genuinely new — invite. inviteUserByEmail fails if the email
  // is already registered, which is exactly the signal we want to fall
  // back to the orphaned-account scan below.
  const inviteResult = await client.auth.admin.inviteUserByEmail(email)
  if (!inviteResult.error && inviteResult.data.user) {
    const { error: insertError } = await client
      .from('liabl_admins')
      .insert({ user_id: inviteResult.data.user.id, email })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    await logAdminAction(admin, {
      actionType: 'admin_added',
      targetUserId: inviteResult.data.user.id,
      metadata: { email, via: 'new_invite' },
    })
    return NextResponse.json({ added: true, via: 'new_invite' })
  }

  // Fallback: an auth.users row exists but wasn't found in
  // operator_members — bounded scan via listUsers().
  const PER_PAGE = 200
  const MAX_PAGES = 5
  for (let page = 1; page <= MAX_PAGES; page++) {
    const listResult = await client.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (listResult.error) break
    const users: User[] = listResult.data.users
    const match = users.find(u => u.email?.toLowerCase() === email)
    if (match) {
      const { error: insertError } = await client.from('liabl_admins').insert({ user_id: match.id, email })
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

      await logAdminAction(admin, {
        actionType: 'admin_added',
        targetUserId: match.id,
        metadata: { email, via: 'orphaned_account_lookup' },
      })
      return NextResponse.json({ added: true, via: 'orphaned_account_lookup' })
    }
    if (users.length < PER_PAGE) break // last page
  }

  return NextResponse.json(
    { error: 'An account with this email may already exist but could not be located automatically. This may need direct database access to resolve.' },
    { status: 500 }
  )
}
