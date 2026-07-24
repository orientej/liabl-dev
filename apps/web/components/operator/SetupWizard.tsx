'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import QRCode from 'qrcode'
import { getCurrentOperatorMember, updateOperatorProfile } from '@/lib/auth'
import { fetchEngineData, type ActivityRecord } from '@/lib/document-engine'
import { createClient } from '@/lib/supabase'
import { saveReviewedClauses, createEmptyTemplate, type ReviewedClause } from '@/lib/template-import'
import { publishTemplateVersion } from '@/lib/template-versions'
import { createSession } from '@/lib/sessions'
import { participantCheckInUrl } from '@/lib/participant-url'
import { CLAUSE_CATEGORIES } from '@/lib/clause-categories'

// Content Management — operator setup wizard.
//
// Replaces the previous OnboardingTab, which was a pure demo simulation:
// no database calls at all, a "Create account" button that only advanced
// local state, and inputs that weren't even wired up. It also wasn't
// mounted anywhere, so it was unreachable dead code.
//
// This one does real work, orchestrating the pieces built across the
// content-management roadmap:
//   1. Business profile      -> real write to operators
//   2. First template        -> upload+parse (Stages 1/3/4) or build by hand
//   3. Publish as version 1  -> Phase 1 template versioning
//   4. First check-in link   -> real session + QR code
//
// Deliberately does NOT cover multi-template check-ins (that phase is
// deprioritized) or a starter template library (explicitly deferred).

type Step = 'profile' | 'template' | 'publish' | 'session' | 'done'
type TemplateMode = 'choose' | 'upload' | 'scratch' | 'existing'
interface ParsedClause { title: string; body: string; category: string }

const STEP_ORDER: Step[] = ['profile', 'template', 'publish', 'session']
const STEP_LABELS: Record<Step, string> = {
  profile:  'Business details',
  template: 'First waiver',
  publish:  'Publish',
  session:  'Check-in link',
  done:     'Done',
}

export default function SetupWizard({ onNavigate }: { onNavigate: (tab: 'templates' | 'sessions') => void }) {
  const [step, setStep] = useState<Step>('profile')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [activities, setActivities] = useState<ActivityRecord[]>([])

  // Step 1
  const [bizName, setBizName] = useState('')
  const [lawState, setLawState] = useState('')

  // Step 2
  const [templateMode, setTemplateMode] = useState<TemplateMode>('choose')
  const [templateName, setTemplateName] = useState('')
  const [clauses, setClauses] = useState<ParsedClause[]>([])
  const [unverifiedCount, setUnverifiedCount] = useState(0)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [existingId, setExistingId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Carried forward
  const [activityId, setActivityId] = useState<string | null>(null)
  const [activityKey, setActivityKey] = useState<string | null>(null)
  const [hasClauses, setHasClauses] = useState(false)

  // Step 4
  const [sessionRef, setSessionRef] = useState('')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sessionTime, setSessionTime] = useState('')
  const [checkInUrl, setCheckInUrl] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) throw new Error('Could not load your account')
      setOperatorId(member.operatorId)
      setBizName(member.operatorName)

      const supabase = createClient()
      const { data: op } = await supabase
        .from('operators').select('governing_law_state').eq('id', member.operatorId).maybeSingle()
      if (op?.governing_law_state) setLawState(op.governing_law_state)

      const engine = await fetchEngineData(supabase)
      setActivities(engine.activities)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (checkInUrl && !qrDataUrl) {
      QRCode.toDataURL(checkInUrl, { width: 220, margin: 1 }).then(setQrDataUrl).catch(() => {})
    }
  }, [checkInUrl, qrDataUrl])

  // ── Step 1 ────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!operatorId) return
    setBusy(true); setError(null)
    try {
      await updateOperatorProfile(operatorId, { name: bizName, governingLawState: lawState })
      setStep('template')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your details')
    } finally { setBusy(false) }
  }

  // ── Step 2 ────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setBusy(true); setError(null); setUploadNotice(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const exRes = await fetch('/api/templates/upload-extract', { method: 'POST', body: fd })
      const exBody = await exRes.json()
      if (!exRes.ok) throw new Error(exBody.error ?? 'Could not read that file')
      if (exBody.notice) setUploadNotice(exBody.notice)

      const text: string = exBody.text ?? ''
      if (text.trim().length < 40) throw new Error('That file didn\u2019t contain enough readable text')

      const segRes = await fetch('/api/templates/segment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const segBody = await segRes.json()
      if (!segRes.ok) throw new Error(segBody.error ?? 'Could not find clauses in that document')

      setClauses(segBody.clauses ?? [])
      setUnverifiedCount(segBody.unverifiedCount ?? 0)
      if (!templateName) setTemplateName(file.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally { setBusy(false) }
  }

  async function saveTemplate() {
    if (!operatorId) return
    setBusy(true); setError(null)
    try {
      if (templateMode === 'upload') {
        const reviewed: ReviewedClause[] = clauses.map(c => ({ title: c.title, body: c.body, category: c.category }))
        const result = await saveReviewedClauses(operatorId, { mode: 'new', displayName: templateName }, reviewed)
        setActivityId(result.activityId); setActivityKey(result.activityKey); setHasClauses(true)
      } else if (templateMode === 'scratch') {
        const created = await createEmptyTemplate(operatorId, templateName)
        setActivityId(created.activityId); setActivityKey(created.activityKey); setHasClauses(false)
      } else {
        const chosen = activities.find(a => a.id === existingId)
        if (!chosen) throw new Error('Please choose a template')
        setActivityId(chosen.id); setActivityKey(chosen.key); setHasClauses(true)
      }
      setStep('publish')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the template')
    } finally { setBusy(false) }
  }

  // ── Step 3 ────────────────────────────────────────────────────────
  async function publish() {
    if (!operatorId || !activityId) return
    setBusy(true); setError(null)
    try {
      await publishTemplateVersion({ operatorId, activityId, changeNote: 'Initial version' })
      setStep('session')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish')
    } finally { setBusy(false) }
  }

  // ── Step 4 ────────────────────────────────────────────────────────
  async function makeSession() {
    if (!operatorId || !activityKey) return
    setBusy(true); setError(null)
    try {
      const id = await createSession({
        operatorId, sessionRef: sessionRef.trim() || 'First check-in',
        sessionTime, sessionDate, activityKey,
      })
      setCheckInUrl(participantCheckInUrl(id))
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the session')
    } finally { setBusy(false) }
  }

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>

  const currentIndex = STEP_ORDER.indexOf(step)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Get set up</h1>
        <p className="text-sm text-gray-400">
          Four steps from here to a working check-in link you can hand to participants.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-6">
        {STEP_ORDER.map((s, i) => {
          const done = step === 'done' || i < currentIndex
          const active = i === currentIndex && step !== 'done'
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center shrink-0 ${
                done ? 'bg-emerald-500 text-white'
                  : active ? 'bg-brand text-white'
                  : 'bg-surface border border-black/10 text-gray-400'
              }`}>{done ? '✓' : i + 1}</div>
              <span className={`text-xs ${active ? 'text-ink font-medium' : 'text-gray-400'}`}>{STEP_LABELS[s]}</span>
              {i < STEP_ORDER.length - 1 && <div className="flex-1 h-px bg-black/10 mx-1" />}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 text-red-400 hover:text-red-700">×</button>
        </div>
      )}

      {/* ── Step 1 ── */}
      {step === 'profile' && (
        <div className="card">
          <h2 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Your business details</h2>
          <p className="text-sm text-gray-400 mb-5">These appear on every waiver your participants sign.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Business name</label>
              <input className="form-input" value={bizName} onChange={e => setBizName(e.target.value)}
                placeholder="e.g. Desert Ridge Adventures" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Governing law state</label>
              <input className="form-input" value={lawState} onChange={e => setLawState(e.target.value)}
                placeholder="e.g. Arizona" />
              <p className="text-xs text-gray-400 mt-1">
                The state whose law your waivers reference. Check with your attorney if you&apos;re unsure.
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={saveProfile} disabled={busy || !bizName.trim() || !lawState.trim()}
              className="btn-primary disabled:opacity-40">
              {busy ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 'template' && (
        <div className="card">
          <h2 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Your first waiver</h2>
          <p className="text-sm text-gray-400 mb-5">
            Bring in a waiver you already use, or start a blank one and write it here.
          </p>

          {templateMode === 'choose' && (
            <div className="space-y-2">
              <button onClick={() => setTemplateMode('upload')}
                className="w-full text-left p-3 rounded-xl border border-black/10 hover:border-brand/40 bg-surface">
                <div className="text-sm font-medium text-ink">Upload a waiver I already have</div>
                <div className="text-xs text-gray-400 mt-0.5">PDF, Word, or text — we&apos;ll split it into clauses for you to review.</div>
              </button>
              <button onClick={() => setTemplateMode('scratch')}
                className="w-full text-left p-3 rounded-xl border border-black/10 hover:border-brand/40 bg-surface">
                <div className="text-sm font-medium text-ink">Start from scratch</div>
                <div className="text-xs text-gray-400 mt-0.5">Create a blank template and write the clauses yourself.</div>
              </button>
              {activities.length > 0 && (
                <button onClick={() => setTemplateMode('existing')}
                  className="w-full text-left p-3 rounded-xl border border-black/10 hover:border-brand/40 bg-surface">
                  <div className="text-sm font-medium text-ink">Use a template I already made</div>
                  <div className="text-xs text-gray-400 mt-0.5">Skip ahead and publish one of your existing templates.</div>
                </button>
              )}
            </div>
          )}

          {templateMode === 'upload' && (
            <div>
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

              {clauses.length === 0 ? (
                <button onClick={() => fileRef.current?.click()} disabled={busy}
                  className="text-xs px-3 py-2 bg-brand text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
                  {busy ? 'Reading your waiver…' : 'Choose a file'}
                </button>
              ) : (
                <>
                  <div className="text-xs text-gray-500 mb-2">
                    Found <span className="text-ink font-medium">{clauses.length}</span> clauses. Edit anything that looks wrong.
                  </div>
                  {unverifiedCount > 0 && (
                    <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                      {unverifiedCount} clause{unverifiedCount === 1 ? '' : 's'} couldn&apos;t be matched word-for-word to your
                      document. Please compare against your original before publishing.
                    </div>
                  )}
                  <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                    {clauses.map((c, i) => (
                      <div key={i} className="bg-surface border border-black/10 rounded-lg p-2.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <input value={c.title}
                            onChange={e => setClauses(p => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                            className="form-input text-xs flex-1" />
                          <select value={c.category}
                            onChange={e => setClauses(p => p.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                            className="text-xs border border-black/10 rounded-lg px-2 py-1.5 shrink-0">
                            {CLAUSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                          <button onClick={() => setClauses(p => p.filter((_, j) => j !== i))}
                            className="text-xs text-red-500 hover:text-red-700 underline shrink-0">Remove</button>
                        </div>
                        <textarea value={c.body}
                          onChange={e => setClauses(p => p.map((x, j) => j === i ? { ...x, body: e.target.value } : x))}
                          className="w-full text-xs border border-black/10 rounded-lg p-2 h-20 font-mono" />
                      </div>
                    ))}
                  </div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name this waiver</label>
                  <input className="form-input mb-3" value={templateName} onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g. Kayak Rental Waiver" />
                </>
              )}

              {uploadNotice && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">{uploadNotice}</div>
              )}
            </div>
          )}

          {templateMode === 'scratch' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name this waiver</label>
              <input className="form-input" value={templateName} onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. Kayak Rental Waiver" />
              <p className="text-xs text-gray-400 mt-2">
                We&apos;ll create it empty — you&apos;ll add clauses in the Template Builder next.
              </p>
            </div>
          )}

          {templateMode === 'existing' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Which template?</label>
              <select className="form-input" value={existingId} onChange={e => setExistingId(e.target.value)}>
                <option value="">Choose…</option>
                {activities.map(a => <option key={a.id} value={a.id}>{a.displayName}</option>)}
              </select>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            {templateMode !== 'choose' && (
              <button onClick={() => { setTemplateMode('choose'); setClauses([]); setError(null) }}
                className="btn-secondary">← Back</button>
            )}
            {templateMode !== 'choose' && (
              <button onClick={saveTemplate} disabled={busy || !canContinueTemplate()}
                className="btn-primary disabled:opacity-40">
                {busy ? 'Saving…' : 'Continue →'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 'publish' && (
        <div className="card">
          <h2 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Publish version 1</h2>
          {hasClauses ? (
            <>
              <p className="text-sm text-gray-400 mb-5">
                Publishing locks in this wording as version 1. Everyone who signs from now on is recorded against
                this exact version, and you can always publish updates later.
              </p>
              <div className="flex gap-3">
                <button onClick={publish} disabled={busy} className="btn-primary disabled:opacity-40">
                  {busy ? 'Publishing…' : 'Publish version 1 →'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-3">
                Your template is created, but it doesn&apos;t have any clauses yet — so there&apos;s nothing to publish.
                Add your clauses in the Template Builder, publish there, then come back to create your check-in link.
              </p>
              <div className="flex gap-3">
                <button onClick={() => onNavigate('templates')} className="btn-primary">Go to Template Builder →</button>
                <button onClick={() => setStep('session')} className="btn-secondary">Skip for now</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 4 ── */}
      {step === 'session' && (
        <div className="card">
          <h2 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Your first check-in</h2>
          <p className="text-sm text-gray-400 mb-5">
            A check-in is one group or time slot. Participants scan its QR code or open its link to sign.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name it</label>
              <input className="form-input" value={sessionRef} onChange={e => setSessionRef(e.target.value)}
                placeholder="e.g. Saturday morning tour" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input type="date" className="form-input" value={sessionDate} onChange={e => setSessionDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Time (optional)</label>
                <input className="form-input" value={sessionTime} onChange={e => setSessionTime(e.target.value)}
                  placeholder="e.g. 9:00 AM" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={makeSession} disabled={busy} className="btn-primary disabled:opacity-40">
              {busy ? 'Creating…' : 'Create check-in →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && checkInUrl && (
        <div className="card text-center">
          <h2 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>You&apos;re set up</h2>
          <p className="text-sm text-gray-400 mb-5">
            Share this link or QR code with participants and they can start signing.
          </p>
          {qrDataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={qrDataUrl} alt="Check-in QR code" className="mx-auto mb-4 rounded-xl border border-black/10" />
          )}
          <div className="flex gap-2 mb-5">
            <input readOnly value={checkInUrl} className="form-input text-xs font-mono flex-1"
              onClick={e => (e.target as HTMLInputElement).select()} />
            <button onClick={() => navigator.clipboard?.writeText(checkInUrl)}
              className="text-xs px-3 py-2 rounded-lg border border-black/10 hover:bg-surface shrink-0">Copy</button>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => onNavigate('sessions')} className="btn-primary">Go to Sessions →</button>
            <button onClick={() => onNavigate('templates')} className="btn-secondary">Edit my waiver</button>
          </div>
        </div>
      )}
    </div>
  )

  function canContinueTemplate(): boolean {
    if (templateMode === 'upload')   return clauses.length > 0 && templateName.trim().length > 0
    if (templateMode === 'scratch')  return templateName.trim().length > 0
    if (templateMode === 'existing') return existingId.length > 0
    return false
  }
}
