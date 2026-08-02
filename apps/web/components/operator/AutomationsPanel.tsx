'use client'
// Marketing automation — M3 console. Two built-in lifecycle automations an
// operator configures and toggles on: a post-visit thank-you and a win-back.
// Config is saved directly (RLS-scoped, like the marketing toggle); a cron
// evaluator + the shared dispatcher do the sending. Copy supports {{first_name}}
// and {{business}} merge tokens.
import { useState, useEffect, useCallback } from 'react'
import {
  listAutomations, upsertAutomation,
  type AutomationRecord, type AutomationTrigger,
} from '@/lib/marketing-client'

interface Def {
  trigger: AutomationTrigger
  title: string
  blurb: string
  delayLabel: string
  defaults: { subject: string; body: string; delayDays: number }
}

const DEFS: Def[] = [
  {
    trigger: 'post_visit',
    title: 'Post-visit thank-you',
    blurb: 'Sent to a contact a set number of days after they check in.',
    delayLabel: 'days after a visit',
    defaults: {
      subject: 'Thanks for visiting {{business}}!',
      body: 'Hi {{first_name}},\n\nThanks for visiting {{business}}! We hope you had a great time. We’d love to see you again soon.',
      delayDays: 1,
    },
  },
  {
    trigger: 'win_back',
    title: 'Win-back',
    blurb: 'Sent when a contact hasn’t visited for a set number of days.',
    delayLabel: 'days since last visit',
    defaults: {
      subject: 'We miss you at {{business}}',
      body: 'Hi {{first_name}},\n\nIt’s been a while! We’d love to have you back at {{business}}. Come see what’s new.',
      delayDays: 90,
    },
  },
]

function blank(def: Def): AutomationRecord {
  return { trigger: def.trigger, channel: 'email', subject: def.defaults.subject, body: def.defaults.body, delayDays: def.defaults.delayDays, active: false }
}

export default function AutomationsPanel({ operatorId, emailCount, smsCount, smsAvailable }: {
  operatorId: string; emailCount: number; smsCount: number; smsAvailable: boolean
}) {
  const [records, setRecords] = useState<Record<string, AutomationRecord>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const rows = await listAutomations(operatorId)
      const map: Record<string, AutomationRecord> = {}
      for (const def of DEFS) map[def.trigger] = rows.find(r => r.trigger === def.trigger) ?? blank(def)
      setRecords(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load automations')
    } finally { setLoading(false) }
  }, [operatorId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="mt-8 text-sm text-gray-500">Loading automations…</div>

  return (
    <div className="mt-10">
      <h3 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Automations</h3>
      <p className="text-sm text-gray-500 mb-4">
        Set-and-forget lifecycle messages. They send automatically to opted-in contacts — with an unsubscribe link
        (and STOP for text) added just like broadcasts. Use <span className="font-mono text-ink">{'{{first_name}}'}</span> and{' '}
        <span className="font-mono text-ink">{'{{business}}'}</span> to personalize.
      </p>
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        {DEFS.map(def => (
          <AutomationCard key={def.trigger} def={def} operatorId={operatorId}
            record={records[def.trigger] ?? blank(def)}
            emailCount={emailCount} smsCount={smsCount} smsAvailable={smsAvailable}
            onSaved={load} />
        ))}
      </div>
    </div>
  )
}

function AutomationCard({ def, operatorId, record, emailCount, smsCount, smsAvailable, onSaved }: {
  def: Def; operatorId: string; record: AutomationRecord
  emailCount: number; smsCount: number; smsAvailable: boolean; onSaved: () => void
}) {
  const [draft, setDraft] = useState<AutomationRecord>(record)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setDraft(record) }, [record])

  function patch(p: Partial<AutomationRecord>) { setDraft(d => ({ ...d, ...p })); setNote(null) }

  async function save(nextActive?: boolean) {
    const toSave = { ...draft, active: nextActive ?? draft.active }
    setBusy(true); setError(null); setNote(null)
    try {
      if (toSave.active) {
        if (!toSave.body.trim()) throw new Error('Add a message before turning this on.')
        if (toSave.channel === 'email' && !(toSave.subject ?? '').trim()) throw new Error('Add a subject before turning this on.')
        if (toSave.channel === 'sms' && !smsAvailable) throw new Error('SMS isn’t configured yet.')
      }
      await upsertAutomation(operatorId, toSave)
      setDraft(toSave)
      setNote(nextActive === undefined ? 'Saved.' : nextActive ? 'On — sending automatically.' : 'Turned off.')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setBusy(false) }
  }

  const reach = draft.channel === 'email' ? emailCount : smsCount

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h4 className="font-medium text-ink">{def.title}</h4>
          <p className="text-xs text-gray-500">{def.blurb}</p>
        </div>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer">
          <span className={`text-xs ${draft.active ? 'text-green-600' : 'text-gray-400'}`}>{draft.active ? 'On' : 'Off'}</span>
          <input type="checkbox" checked={draft.active} disabled={busy} onChange={e => save(e.target.checked)} />
        </label>
      </div>

      <div className="flex gap-2 my-3">
        {(['email', 'sms'] as const).map(ch => (
          <button key={ch} type="button" onClick={() => patch({ channel: ch })}
            disabled={ch === 'sms' && !smsAvailable}
            className={`flex-1 text-sm rounded-xl border px-3 py-2 disabled:opacity-40 ${draft.channel === ch ? 'border-brand text-brand bg-brand/5' : 'border-black/10 text-gray-500'}`}>
            {ch === 'email' ? 'Email' : 'Text'} <span className="text-xs opacity-60">· {ch === 'email' ? emailCount : smsCount}</span>
          </button>
        ))}
      </div>

      <label className="block text-xs text-gray-500 mb-3">
        Send
        <input type="number" min={0} max={3650} value={draft.delayDays}
          onChange={e => patch({ delayDays: Math.max(0, Math.min(3650, Number(e.target.value) || 0)) })}
          className="form-input inline-block w-20 mx-2 py-1 text-center" />
        {def.delayLabel}
      </label>

      {draft.channel === 'email' && (
        <input className="form-input w-full mb-2" value={draft.subject ?? ''} onChange={e => patch({ subject: e.target.value })}
          placeholder="Subject line" maxLength={200} />
      )}
      <textarea className="form-input w-full mb-1" rows={draft.channel === 'sms' ? 4 : 5} value={draft.body}
        onChange={e => patch({ body: e.target.value })}
        placeholder={draft.channel === 'email' ? 'Write your email…' : 'Write your text message…'} />
      {draft.channel === 'sms' && (
        <p className="text-[11px] text-gray-400 mb-2">{draft.body.length} characters · “Reply STOP to opt out.” is appended automatically.</p>
      )}

      {note && <div className="my-2 text-xs text-green-600">{note}</div>}
      {error && <div className="my-2 text-xs text-red-600">{error}</div>}

      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-gray-400">
          {draft.active ? `Active · ${reach} ${draft.channel === 'email' ? 'email' : 'SMS'} subscriber${reach === 1 ? '' : 's'} eligible` : 'Not sending'}
        </span>
        <button onClick={() => save()} disabled={busy} className="btn-secondary text-sm">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
