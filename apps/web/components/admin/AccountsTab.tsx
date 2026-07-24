'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchOperators, createOperator, updateOperator, type AdminOperator } from '@/lib/admin'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia',
  'Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland',
  'Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
]

export default function AccountsTab() {
  const [operators, setOperators] = useState<AdminOperator[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setOperators(await fetchOperators())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load operators')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function toggleStatus(op: AdminOperator) {
    setActionError(null)
    try {
      await updateOperator(op.id, { status: op.status === 'active' ? 'suspended' : 'active' })
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  if (loading) return <div className="px-5 py-10 text-center text-sm text-gray-400">Loading accounts…</div>
  if (loadError) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{loadError}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Customer accounts</h1>
          <p className="text-sm text-gray-400">{operators.length} operator{operators.length === 1 ? '' : 's'} on the platform.</p>
        </div>
        <button onClick={() => setCreating(true)} className="text-sm px-4 py-2 bg-brand text-white rounded-xl font-medium hover:opacity-90">
          + New account
        </button>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 flex justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>×</button>
        </div>
      )}

      {creating && (
        <CreateOperatorForm onCancel={() => setCreating(false)} onCreated={async () => { setCreating(false); await refresh() }} onError={setActionError} />
      )}

      <div className="space-y-2">
        {operators.map(op => (
          editingId === op.id ? (
            <EditOperatorForm key={op.id} operator={op} onCancel={() => setEditingId(null)}
              onSaved={async () => { setEditingId(null); await refresh() }} onError={setActionError} />
          ) : (
            <div key={op.id} className="bg-white rounded-xl border border-black/8 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{op.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${op.status === 'active' ? 'bg-success-light text-success-deep' : 'bg-red-50 text-red-700'}`}>
                    {op.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {op.slug} · {op.governing_law_state} · {op.memberCount} member{op.memberCount === 1 ? '' : 's'} · {op.waiverCount} waiver{op.waiverCount === 1 ? '' : 's'} signed · plan limit {op.plan_signature_limit}/mo
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditingId(op.id)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 hover:bg-surface">Edit</button>
                <button onClick={() => toggleStatus(op)}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${op.status === 'active' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                  {op.status === 'active' ? 'Suspend' : 'Reactivate'}
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

function CreateOperatorForm({ onCancel, onCreated, onError }: { onCancel: () => void; onCreated: () => Promise<void>; onError: (e: string) => void }) {
  const [name, setName] = useState('')
  const [lawState, setLawState] = useState('')
  const [lawCounty, setLawCounty] = useState('')
  const [limit, setLimit] = useState(500)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!name.trim() || !lawState.trim()) return
    setSubmitting(true)
    try {
      await createOperator({ name, governingLawState: lawState, governingLawCounty: lawCounty, planSignatureLimit: limit })
      await onCreated()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to create operator')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-brand/20 p-5 mb-4">
      <h3 className="font-semibold text-sm text-ink mb-4">New operator account</h3>
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Organization name</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Canyon Tours Co" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Governing law — state</label>
          <select className="form-input" value={lawState} onChange={e => setLawState(e.target.value)}>
            <option value="">Select…</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">County (optional)</label>
          <input className="form-input" value={lawCounty} onChange={e => setLawCounty(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Monthly signature limit</label>
          <input type="number" className="form-input" value={limit} onChange={e => setLimit(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary py-2 text-sm">Cancel</button>
        <button onClick={submit} disabled={submitting || !name.trim() || !lawState.trim()} className="btn-primary py-2 text-sm">
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </div>
    </div>
  )
}

function EditOperatorForm({ operator, onCancel, onSaved, onError }: {
  operator: AdminOperator; onCancel: () => void; onSaved: () => Promise<void>; onError: (e: string) => void
}) {
  const [name, setName] = useState(operator.name)
  const [lawState, setLawState] = useState(operator.governing_law_state)
  const [lawCounty, setLawCounty] = useState(operator.governing_law_county ?? '')
  const [limit, setLimit] = useState(operator.plan_signature_limit)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    try {
      await updateOperator(operator.id, {
        name, governingLawState: lawState, governingLawCounty: lawCounty || null, planSignatureLimit: limit,
      })
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-brand/20 p-5">
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Organization name</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Governing law — state</label>
          <select className="form-input" value={lawState} onChange={e => setLawState(e.target.value)}>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">County</label>
          <input className="form-input" value={lawCounty} onChange={e => setLawCounty(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Monthly signature limit</label>
          <input type="number" className="form-input" value={limit} onChange={e => setLimit(Number(e.target.value))} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary py-2 text-sm">Cancel</button>
        <button onClick={submit} disabled={submitting || !name.trim()} className="btn-primary py-2 text-sm">
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
