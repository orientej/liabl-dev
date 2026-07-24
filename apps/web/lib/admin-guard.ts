// lib/admin-guard.ts
// v25 Global Admin Console — server-only.
//
// requireAdmin() is the REAL authorization check (unlike
// lib/admin-auth.ts's client-side version, which is UI-routing
// convenience only). Every /api/admin/* route calls this before doing
// anything, independent of whatever middleware.ts already checked —
// defense-in-depth, not redundancy for its own sake.

import { createClient as createServerClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export interface AdminIdentity {
  userId: string
  email:  string
}

export async function requireAdmin(): Promise<AdminIdentity | null> {
  const sessionClient = createServerClient()
  const { data: { user } } = await sessionClient.auth.getUser()
  if (!user) return null

  // Service-role client for the actual membership check — not because
  // the self-check RLS policy wouldn't also allow this via the session
  // client, but because every other admin operation in these routes
  // already needs the admin client regardless, and checking membership
  // the same way everything else is checked keeps this one code path
  // simple to reason about.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('liabl_admins')
    .select('email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return { userId: user.id, email: data.email }
}

export interface LogAdminActionInput {
  actionType: string
  targetOperatorId?: string | null
  targetUserId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function logAdminAction(admin: AdminIdentity, input: LogAdminActionInput): Promise<void> {
  const client = createAdminClient()
  const { error } = await client.from('admin_audit_log').insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action_type: input.actionType,
    target_operator_id: input.targetOperatorId ?? null,
    target_user_id: input.targetUserId ?? null,
    metadata: input.metadata ?? null,
  })
  if (error) {
    // Never let a logging failure block the actual admin action that
    // already succeeded — but this should be rare and is worth knowing
    // about if it happens.
    console.error('[logAdminAction] failed to write audit log:', error.message)
  }
}
