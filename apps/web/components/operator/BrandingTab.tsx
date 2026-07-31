'use client'
// Private labeling — operator "Branding" area. Set a logo (upload to the
// public 'branding' bucket, or paste an https URL), a primary and accent
// color, and whether to hide the "Powered by Liabl" attribution. A live
// preview shows how the participant check-in will look. Saving writes through
// /api/branding (colors validated server-side, operator taken from the
// session). Nothing here affects the operator console's own colors — branding
// only themes the participant-facing surfaces.
import { useState, useEffect, useCallback } from 'react'
import { getCurrentOperatorMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { fetchBranding, isValidHex, LIABL_DEFAULT_PRIMARY, LIABL_DEFAULT_ACCENT } from '@/lib/branding'

export default function BrandingTab() {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [operatorName, setOperatorName] = useState<string>('Your brand')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [logoUrl, setLogoUrl] = useState('')
  const [primary, setPrimary] = useState('')
  const [accent, setAccent] = useState('')
  const [hidePoweredBy, setHidePoweredBy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) throw new Error('No operator account for your login.')
      setOperatorId(member.operatorId)
      if (member.operatorName) setOperatorName(member.operatorName)
      const b = await fetchBranding(createClient(), member.operatorId)
      setLogoUrl(b.logoUrl ?? '')
      setPrimary(b.primaryColor ?? '')
      setAccent(b.accentColor ?? '')
      setHidePoweredBy(b.hidePoweredBy)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load branding')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !operatorId) return
    setUploading(true); setError(null); setSaved(false)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${operatorId}/logo-${Date.now()}.${ext}`
      const supabase = createClient()
      const { error: upErr } = await supabase.storage.from('branding').upload(path, file, { upsert: true, cacheControl: '3600' })
      if (upErr) throw new Error(`${upErr.message}. If the 'branding' bucket doesn't exist yet, paste a hosted URL instead.`)
      const { data } = supabase.storage.from('branding').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logo upload failed')
    } finally { setUploading(false) }
  }

  async function handleSave() {
    if ((primary && !isValidHex(primary)) || (accent && !isValidHex(accent))) {
      setError('Colors must be valid #RRGGBB values.'); return
    }
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/branding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl: logoUrl.trim() || null,
          primaryColor: primary.trim() || null,
          accentColor: accent.trim() || null,
          hidePoweredBy,
        }),
      })
      const b = await res.json()
      if (!res.ok) { setError(b.error || 'Failed to save'); return }
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save branding')
    } finally { setSaving(false) }
  }

  const previewPrimary = isValidHex(primary) ? primary : LIABL_DEFAULT_PRIMARY
  const previewAccent  = isValidHex(accent)  ? accent  : LIABL_DEFAULT_ACCENT

  if (loading) return <div className="text-sm text-gray-500">Loading branding…</div>

  const colorRow = (label: string, value: string, set: (v: string) => void, fallback: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={isValidHex(value) ? value : fallback} onChange={e => set(e.target.value)}
          className="h-9 w-12 rounded-lg border border-black/10 bg-white p-0.5 cursor-pointer" aria-label={label} />
        <input className="form-input font-mono" style={{ maxWidth: 140 }} value={value} placeholder={fallback}
          onChange={e => set(e.target.value)} />
        {value && (
          <button onClick={() => set('')} className="text-xs text-gray-400 hover:text-gray-600 underline">Reset to default</button>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Branding</h2>
        <p className="text-sm text-gray-500">
          Make the participant check-in look like your brand. These settings apply to your check-in pages,
          organizer &amp; reservation pages, confirmation emails, and sealed PDFs — not to this console.
        </p>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
      {saved && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 text-sm">Branding saved. Participant surfaces will use it right away.</div>}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Editor */}
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Logo</label>
            {logoUrl && (
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Logo preview" className="h-10 max-w-[160px] object-contain" />
                <button onClick={() => setLogoUrl('')} className="text-xs text-gray-400 hover:text-red-500 underline">Remove</button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="btn-secondary text-sm cursor-pointer">
                {uploading ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoFile} disabled={uploading} />
              </label>
              <span className="text-xs text-gray-400">or</span>
            </div>
            <input className="form-input mt-2" value={logoUrl} placeholder="https://yourbrand.com/logo.png"
              onChange={e => setLogoUrl(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">PNG, JPG, or SVG. Uploads go to your public branding bucket.</p>
          </div>

          {colorRow('Primary color', primary, setPrimary, LIABL_DEFAULT_PRIMARY)}
          {colorRow('Accent color', accent, setAccent, LIABL_DEFAULT_ACCENT)}

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={hidePoweredBy} onChange={e => setHidePoweredBy(e.target.checked)} />
            Hide &ldquo;Powered by Liabl&rdquo; on participant pages
          </label>

          <button onClick={handleSave} disabled={saving || uploading} className="btn-primary text-sm" style={{ maxWidth: 200 }}>
            {saving ? 'Saving…' : 'Save branding'}
          </button>
        </div>

        {/* Live preview */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Preview</div>
          <div className="rounded-2xl border border-black/10 overflow-hidden">
            <div className="p-5" style={{ background: '#F7F6F2' }}>
              <div className="rounded-2xl bg-white border border-black/10 p-5 shadow-sm">
                <div className="h-9 mb-4 flex items-center">
                  {logoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={logoUrl} alt="" className="h-9 max-w-[180px] object-contain" />
                    : <span className="font-serif text-xl" style={{ color: previewPrimary }}>{operatorName}</span>}
                </div>
                <div className="text-sm text-ink font-medium mb-1">Sign your waiver</div>
                <div className="text-xs text-gray-500 mb-4">Please review and sign to complete your check-in.</div>
                <div className="rounded-lg text-white text-center text-sm font-semibold py-2.5 mb-3" style={{ background: previewPrimary }}>
                  Continue
                </div>
                <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ background: previewAccent + '22', color: previewAccent }}>
                  1 of 3 signed
                </span>
              </div>
              {!hidePoweredBy && (
                <div className="text-center text-[11px] text-gray-400 mt-3">Powered by Liabl</div>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Approximate — the live pages use your exact theme.</p>
        </div>
      </div>
    </div>
  )
}
