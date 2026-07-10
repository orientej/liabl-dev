// lib/auth.ts
// v25 Milestone 5 — operator authentication.
//
// Deliberately decouples two things that could otherwise get conflated:
// 1. "Does this person have a login?" (a Supabase Auth user)
// 2. "Which operator do they belong to?" (an operator_members row)
//
// Why: whether signUp() returns an active session immediately depends on
// a Supabase project setting (email confirmation) this code can't see or
// control. If confirmation is required, the auth user exists but there's
// no session to act on yet — so operator creation can't safely happen at
// signup time in every case. Instead, operator setup happens on first
// successful login, gated on whether operator_members already has a row
// for this user. This is correct regardless of the project's email
// confirmation setting, rather than assuming one or the other.

import { createClient } from '@/lib/supabase'

export interface CurrentOperatorMember {
  userId:       string
  userEmail:    string | null
  operatorId:   string
  operatorSlug: string
  operatorName: string
  operatorStatus: 'active' | 'suspended'
  role: 'owner' | 'staff'
}

export interface SignUpResult {
  needsEmailConfirmation: boolean
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  // data.session is null when the project requires email confirmation
  // before the account can be used — not an error, just a different path.
  return { needsEmailConfirmation: !data.session }
}

export async function signIn(email: string, password: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

/** Null means: logged in, but no operator_members row yet — caller
 * should route to setup, not the dashboard. Also null if not logged in
 * at all; callers that need to distinguish those two cases should check
 * auth state separately (the login page does, via onAuthStateChange). */
export async function getCurrentOperatorMember(): Promise<CurrentOperatorMember | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('operator_members')
    .select('role, operators(id, slug, name, status)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[getCurrentOperatorMember]', error.message)
    return null
  }
  if (!data) return null

  const operator = Array.isArray(data.operators) ? data.operators[0] : data.operators
  if (!operator) return null

  return {
    userId:       user.id,
    userEmail:    user.email ?? null,
    operatorId:   operator.id,
    operatorSlug: operator.slug,
    operatorName: operator.name,
    operatorStatus: operator.status as 'active' | 'suspended',
    role:         data.role as 'owner' | 'staff',
  }
}

export interface CompleteSetupInput {
  operatorName: string
  governingLawState: string
  governingLawCounty: string
}

/** Called once, right after a logged-in user is found to have no
 * operator_members row — creates their operator business record and
 * links them to it as owner. */
export async function completeOperatorSetup(input: CompleteSetupInput): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('completeOperatorSetup called with no authenticated user')

  const slug = input.operatorName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `operator-${user.id.slice(0, 8)}`

  const { data: operator, error: operatorError } = await supabase
    .from('operators')
    .insert({
      slug,
      name: input.operatorName.trim(),
      governing_law_state: input.governingLawState.trim(),
      governing_law_county: input.governingLawCounty.trim() || null,
    })
    .select('id')
    .single()

  if (operatorError) throw new Error(`create operator: ${operatorError.message}`)
  if (!operator) throw new Error('create operator returned no data')

  const { error: memberError } = await supabase
    .from('operator_members')
    .insert({ user_id: user.id, operator_id: operator.id, role: 'owner', email: user.email })

  if (memberError) {
    // The operator record was created but the membership link failed —
    // don't leave the user stuck with an orphaned operator and no way in.
    throw new Error(
      `organization "${input.operatorName}" was created, but linking your account to it failed: ` +
      `${memberError.message}. Contact support rather than trying to create it again.`
    )
  }
}

export interface UpdateOperatorProfileInput {
  name?: string
  governingLawState?: string
  governingLawCounty?: string | null
}

/** Edits the organization's own profile — name and governing law. Relies
 * entirely on the existing operators_update_own RLS policy
 * (011_m5_rls_tighten.sql) to restrict this to the caller's own
 * operator; no separate authorization check needed here. */
export async function updateOperatorProfile(operatorId: string, input: UpdateOperatorProfileInput): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (input.name               !== undefined) patch.name                 = input.name.trim()
  if (input.governingLawState  !== undefined) patch.governing_law_state  = input.governingLawState.trim()
  if (input.governingLawCounty !== undefined) patch.governing_law_county = input.governingLawCounty?.trim() || null

  const { error } = await supabase.from('operators').update(patch).eq('id', operatorId)
  if (error) throw new Error(`update operator profile: ${error.message}`)
}
