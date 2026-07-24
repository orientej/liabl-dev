// lib/invites.ts
// v25 M6+ — team invites. Uses the normal authenticated browser client
// throughout; operator_invites_manage_own (017_m6_team_invites.sql)
// already scopes everything here to the caller's own operator via RLS,
// same as every other operator-dashboard lib file.
//
// Acceptance is NOT here — that's app/api/invites/accept/route.ts, which
// deliberately uses the admin client instead, since the person accepting
// doesn't belong to the operator yet and RLS can't authorize them the
// way it does everything in this file.

import { createClient } from '@/lib/supabase'

export interface TeamMember {
  id: string
  email: string | null
  role: 'owner' | 'staff'
  joinedAt: string
}

export interface Invite {
  id: string
  email: string
  role: 'owner' | 'staff'
  status: 'pending' | 'accepted' | 'revoked'
  expiresAt: string
  createdAt: string
}

export async function listTeamMembers(operatorId: string): Promise<TeamMember[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('operator_members')
    .select('id, email, role, created_at')
    .eq('operator_id', operatorId)
    .order('created_at')

  if (error) throw new Error(`list team members: ${error.message}`)
  return (data ?? []).map(r => ({
    id: r.id, email: r.email, role: r.role as 'owner' | 'staff', joinedAt: r.created_at,
  }))
}

export async function listInvites(operatorId: string): Promise<Invite[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('operator_invites')
    .select('id, email, role, status, expires_at, created_at')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`list invites: ${error.message}`)
  return (data ?? []).map(r => ({
    id: r.id, email: r.email, role: r.role as 'owner' | 'staff',
    status: r.status as Invite['status'], expiresAt: r.expires_at, createdAt: r.created_at,
  }))
}

export interface CreateInviteInput {
  operatorId: string
  email: string
  role: 'owner' | 'staff'
  invitedByUserId: string
}

/** Creates the invite row and returns its token — the caller (the
 * Settings tab) is responsible for triggering the actual email send via
 * the send-invite-email route, keeping this function's job narrowly
 * "write the row," matching how the rest of this app separates DB writes
 * from side effects like email/notifications. */
export async function createInvite(input: CreateInviteInput): Promise<{ id: string; token: string }> {
  const supabase = createClient()

  // Don't create a duplicate pending invite for the same email —
  // surface the existing one instead of silently generating a second,
  // different token for the same address.
  const { data: existing } = await supabase
    .from('operator_invites')
    .select('id, token')
    .eq('operator_id', input.operatorId)
    .eq('email', input.email.trim().toLowerCase())
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) return { id: existing.id, token: existing.token }

  const { data, error } = await supabase
    .from('operator_invites')
    .insert({
      operator_id: input.operatorId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      invited_by: input.invitedByUserId,
    })
    .select('id, token')
    .single()

  if (error) throw new Error(`create invite: ${error.message}`)
  if (!data) throw new Error('create invite returned no data')
  return { id: data.id, token: data.token }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('operator_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)

  if (error) throw new Error(`revoke invite: ${error.message}`)
}
