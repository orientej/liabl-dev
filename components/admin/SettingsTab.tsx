'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchSettings, updateSetting, type PlatformSetting } from '@/lib/admin'

export default function SettingsTab() {
  const [settings, setSettings] = useState<PlatformSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setSettings(await fetchSettings())
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function toggleBoolean(setting: PlatformSetting) {
    setBusyKey(setting.key)
    setActionError(null)
    try {
      await updateSetting(setting.key, !setting.value)
      await refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to update setting')
    } finally {
      setBusyKey(null)
    }
  }

  if (loading) return <div className="px-5 py-10 text-center text-sm text-gray-400">Loading settings…</div>
  if (loadError) return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{loadError}</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Platform settings</h1>
        <p className="text-sm text-gray-400">Config and feature flags shared across every operator.</p>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 flex justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>×</button>
        </div>
      )}

      <div className="space-y-2">
        {settings.map(s => (
          <div key={s.key} className="bg-white rounded-xl border border-black/8 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink">{s.key}</div>
              {s.description && <div className="text-xs text-gray-400 mt-0.5">{s.description}</div>}
            </div>
            {typeof s.value === 'boolean' ? (
              <button
                onClick={() => toggleBoolean(s)}
                disabled={busyKey === s.key}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${s.value ? 'bg-brand' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${s.value ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            ) : (
              <RawValueEditor setting={s} onSaved={refresh} onError={setActionError} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RawValueEditor({ setting, onSaved, onError }: {
  setting: PlatformSetting; onSaved: () => Promise<void>; onError: (e: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState(JSON.stringify(setting.value))
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    try {
      const parsed = JSON.parse(raw)
      await updateSetting(setting.key, parsed)
      setEditing(false)
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Invalid JSON or failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 hover:bg-surface font-mono">
        {JSON.stringify(setting.value)}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input className="form-input font-mono text-xs w-40" value={raw} onChange={e => setRaw(e.target.value)} />
      <button onClick={submit} disabled={submitting} className="text-xs text-brand underline">Save</button>
      <button onClick={() => setEditing(false)} className="text-xs text-gray-400 underline">Cancel</button>
    </div>
  )
}
