// lib/admin-auth.ts
// v25 Global Admin Console.
//
// This is a UI-routing convenience only — "should I show the admin
// shell or redirect to /admin/login" — never the real authorization.
// Real authorization for every privileged action happens server-side in
// each /api/admin/* route, which independently re-checks liabl_admins
// membership using the caller's own session. Never trust this check
// alone to gate a mutating action.

import { createClient } from '@/lib/supabase'

export interface CurrentAdmin {
  userId: string
  email:  string
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('liabl_admins')
    .select('email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[getCurrentAdmin]', error.message)
    return null
  }
  if (!data) return null

  return { userId: user.id, email: data.email }
}
