// lib/admin.ts
// v25 Global Admin Console — client-side wrappers around /api/admin/*.
// All actual authorization happens server-side in each route
// (lib/admin-guard.ts); these are just typed fetch wrappers.

export interface AdminOperator {
  id: string
  slug: string
  name: string
  status: 'active' | 'suspended'
  governing_law_state: string
  governing_law_county: string | null
  plan_signature_limit: number
  created_at: string
  memberCount: number
  waiverCount: number
}

export async function fetchOperators(): Promise<AdminOperator[]> {
  const res = await fetch('/api/admin/operators')
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to load operators')
  return body.operators
}

export interface CreateOperatorInput {
  name: string
  governingLawState: string
  governingLawCounty?: string
  planSignatureLimit?: number
}

export async function createOperator(input: CreateOperatorInput): Promise<{ id: string; slug: string }> {
  const res = await fetch('/api/admin/operators', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to create operator')
  return body
}

export interface UpdateOperatorInput {
  name?: string
  governingLawState?: string
  governingLawCounty?: string | null
  planSignatureLimit?: number
  status?: 'active' | 'suspended'
}

export async function updateOperator(id: string, input: UpdateOperatorInput): Promise<void> {
  const res = await fetch(`/api/admin/operators/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to update operator')
}

export interface AdminUser {
  id: string
  userId: string
  email: string | null
  role: 'owner' | 'staff'
  joinedAt: string
  operatorId: string | null
  operatorName: string
  operatorSlug: string | null
  operatorStatus: 'active' | 'suspended' | null
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const res = await fetch('/api/admin/users')
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to load users')
  return body.users
}

export async function updateUserRole(memberId: string, role: 'owner' | 'staff'): Promise<void> {
  const res = await fetch(`/api/admin/users/${memberId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to update role')
}

export async function removeUser(memberId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${memberId}`, { method: 'DELETE' })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to remove user')
}

export interface PlatformOverview {
  totalOperators: number
  activeOperators: number
  suspendedOperators: number
  totalMembers: number
  totalWaivers: number
  waiversThisMonth: number
  operatorsNearLimit: { operatorId: string; used: number; limit: number }[]
  trend: { date: string; count: number }[]
}

export async function fetchOverview(): Promise<PlatformOverview> {
  const res = await fetch('/api/admin/reporting/overview')
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to load overview')
  return body
}

export interface PlatformSetting {
  key: string
  value: unknown
  description: string | null
  updated_at: string
}

export async function fetchSettings(): Promise<PlatformSetting[]> {
  const res = await fetch('/api/admin/settings')
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to load settings')
  return body.settings
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  const res = await fetch(`/api/admin/settings/${key}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Failed to update setting')
}
