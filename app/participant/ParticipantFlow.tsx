'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { ParticipantAnswers, WaiverClause, EngineData, generateClauses, fetchEngineData, buildActivityLabels } from '@/lib/document-engine'
import { sealWaiver } from '@/lib/seal'
import { logEvent } from '@/lib/audit'
import Logo           from '@/components/Logo'
import ProgressBar    from '@/components/participant/ProgressBar'
import StepEntry      from '@/components/participant/StepEntry'
import StepIdentity   from '@/components/participant/StepIdentity'
import StepActivity   from '@/components/participant/StepActivity'
import StepHealth     from '@/components/participant/StepHealth'
import { StepGuardian } from '@/components/participant/StepGuardian'
import StepDocument   from '@/components/participant/StepDocument'
import StepSignature  from '@/components/participant/StepSignature'
import StepConfirm    from '@/components/participant/StepConfirm'
import PageNav from '@/components/PageNav'

const ADULT_STEPS = ['Identity','Activity','Health','Review','Sign']
const MINOR_STEPS = ['Identity','Activity','Health','Guardian','Review','Sign']

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'retryable_error'; attempts: number; lastError: string }
  | { kind: 'fatal_error' }

const DEMO_SESSION_FALLBACK = 'demo'

export default function ParticipantFlow() {
  const searchParams       = useSearchParams()
  const sessionIdFromQuery = searchParams.get('session')
  const sessionId          = sessionIdFromQuery || DEMO_SESSION_FALLBACK

  const [step,         setStep]         = useState(0)
  const [answers,      setAnswers]      = useState<Partial<ParticipantAnswers>>({})
  const [clauses,      setClauses]      = useState<WaiverClause[]>([])
  const [saveState,    setSaveState]    = useState<SaveState>({ kind: 'idle' })
  const [pendingSignature, setPendingSignature] = useState<string | null>(null)
  const [engineData,   setEngineData]   = useState<EngineData | null>(null)
  const [engineError,  setEngineError]  = useState<string | null>(null)

  const labels = engineData ? buildActivityLabels(engineData) : {}

  // Resolved session UUID — available once the flow has touched the DB.
  // Stored in a ref (not state) because it's infrastructure, not UI state;
  // we never want a re-render triggered by it.
  const resolvedSessionIdRef = useRef<string | null>(null)

  // IP captured once at flow start and reused across all events
  const ipAddressRef = useRef<string | null>(null)

  const isMinor    = answers.isMinor ?? false
  const stepLabels = isMinor ? MINOR_STEPS : ADULT_STEPS

  // ── Event 1: session.started ──────────────────────────────────────────────
  // Fires once when the flow mounts. We don't have a resolved session UUID
  // yet (that requires a DB round-trip), so we log with the raw sessionId
  // string in metadata and null for session_id FK. This is the honest
  // representation — we know the participant arrived, not yet which session.
  //
  // We also grab the IP here so it's available for all subsequent events.
  useEffect(() => {
    async function onFlowStart() {
      // Best-effort IP capture (same route as signing flow)
      try {
        const res = await fetch('/api/client-ip')
        if (res.ok) {
          const data = await res.json()
          ipAddressRef.current = data.ip ?? null
        }
      } catch { /* non-fatal */ }

      await logEvent({
        eventType: 'session.started',
        sessionId: null,   // no FK yet — raw ID in metadata
        operatorId: null,  // genuinely unknown at this point — engine data
                           // hasn't loaded yet (fetched in parallel below,
                           // not before, so timing here stays accurate)
        metadata:  { sessionParam: sessionId },
        ipAddress: ipAddressRef.current,
      })
    }
    onFlowStart()

    // v25 M4 — fetch this operator's activities/clauses once at flow
    // start, so they're ready by the time the participant reaches the
    // Activity step. Single-operator V1 still, so no session->operator
    // resolution here yet (fetchEngineData defaults to the one operator
    // that exists) — that becomes necessary once a second operator does.
    async function loadEngineData() {
      try {
        const { createClient } = await import('@/lib/supabase')
        const data = await fetchEngineData(createClient())
        setEngineData(data)
      } catch (err) {
        console.error('[ParticipantFlow] engine data load failed:', err)
        setEngineError(err instanceof Error ? err.message : 'Failed to load activities')
      }
    }
    loadEngineData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function next(update?: Partial<ParticipantAnswers>) {
    const merged = { ...answers, ...update }
    setAnswers(merged)

    if (merged.activityKey && merged.fullName) {
      if (!engineData) {
        // Shouldn't normally happen — engine data loads at flow start,
        // well before the participant can reach this point — but fail
        // safe rather than crash on a slow network.
        console.error('[next] engine data not loaded yet; cannot generate clauses')
      } else {
        const generated = generateClauses(engineData, merged as ParticipantAnswers)
        setClauses(generated)

        // ── Event 2: waiver.generated ───────────────────────────────────────
        // Fires when the adaptive document is assembled for the first time.
        // Fire-and-forget — don't block the UI transition.
        logEvent({
          eventType: 'waiver.generated',
          sessionId: resolvedSessionIdRef.current,
          operatorId: engineData.operatorId,
          metadata: {
            activityKey:   merged.activityKey,
            clauseCount:   generated.length,
            adaptiveCount: generated.filter(c => c.highlight).length,
          },
          ipAddress: ipAddressRef.current,
        })
      }
    }

    const nextStep = step === 3 && !merged.isMinor ? 5 : step + 1
    setStep(nextStep)
  }

  function prev() { setStep(step === 5 && !isMinor ? 3 : Math.max(0, step - 1)) }

  // ── Event 3: document.viewed ──────────────────────────────────────────────
  // Called from StepDocument's "Sign Document" button via a thin wrapper.
  // Represents the participant having read through (or at least clicked past)
  // the document — the closest proxy we have to "all clauses reviewed"
  // without instrumenting scroll depth.
  function onDocumentProceed() {
    logEvent({
      eventType: 'document.viewed',
      sessionId: resolvedSessionIdRef.current,
      operatorId: engineData?.operatorId ?? null,
      metadata: {
        clauseCount:   clauses.length,
        adaptiveCount: clauses.filter(c => c.highlight).length,
      },
      ipAddress: ipAddressRef.current,
    })
    setStep(6)
  }

  async function attemptSave(sigData: string): Promise<void> {
    setSaveState({ kind: 'saving' })

    if (!engineData) {
      // Shouldn't happen in practice — see the same guard in next() — but
      // the waiver insert now requires operator_id, so this can't be a
      // soft warning here the way it is in next(); there's nothing valid
      // to save without it.
      setSaveState({ kind: 'retryable_error', attempts: 1, lastError: 'Activity data not loaded yet' })
      return
    }

    try {
      const { createClient } = await import('@/lib/supabase')
      const supabase = createClient()
      const full = answers as ParticipantAnswers

      // 1. Upsert participant
      const { data: participant, error: participantError } = await supabase
        .from('participants')
        .upsert(
          { email: full.email, full_name: full.fullName, dob: full.dob },
          { onConflict: 'email' }
        )
        .select('id')
        .single()

      if (participantError) throw new Error(`participant upsert: ${participantError.message}`)
      if (!participant) throw new Error('participant upsert returned no data')

      // 2. Resolve session
      let resolvedSessionId: string
      if (sessionId === DEMO_SESSION_FALLBACK) {
        const { data: demoSession, error: demoErr } = await supabase
          .from('sessions').select('id').limit(1).maybeSingle()
        if (demoErr) throw new Error(`demo session lookup: ${demoErr.message}`)
        if (!demoSession) throw new Error('no demo session configured')
        resolvedSessionId = demoSession.id
      } else {
        const { data: realSession, error: sessionErr } = await supabase
          .from('sessions').select('id').eq('id', sessionId).maybeSingle()
        if (sessionErr) throw new Error(`session lookup: ${sessionErr.message}`)
        if (!realSession) throw new Error(`session ${sessionId} not found`)
        resolvedSessionId = realSession.id
      }

      // Store resolved UUID so pre-signing logEvent calls that happened
      // before we had it can be linked in metadata at least (they already
      // fired, but future events in this session will have the real FK)
      resolvedSessionIdRef.current = resolvedSessionId

      // 3. Insert waiver
      // v25 M5 RLS — waiverId is generated client-side and the insert
      // deliberately doesn't .select() the row back. Supabase/PostgREST's
      // insert-then-select pattern requires a SELECT policy to return the
      // row, and waivers intentionally has none for anonymous requests —
      // giving participants read access to the table would mean anyone
      // could read anyone's health data via a direct API call. Since we
      // already know the ID we chose, there's nothing to read back.
      const waiverId  = crypto.randomUUID()
      const signedAt  = new Date().toISOString()
      const { error: waiverError } = await supabase
        .from('waivers')
        .insert({
          id:             waiverId,
          session_id:     resolvedSessionId,
          participant_id: participant.id,
          operator_id:    engineData.operatorId,
          activity_key:   full.activityKey,
          answers:        full,
          clauses,
          signed_at:      signedAt,
          signature_data: sigData,
          is_minor:       full.isMinor ?? false,
          guardian_name:  full.guardianName ?? null,
          ip_address:     ipAddressRef.current,
        })

      if (waiverError) throw new Error(`waiver insert: ${waiverError.message}`)

      // ── Event 4: waiver.signed ────────────────────────────────────────────
      // First event with a real waiver_id FK. Awaited so the timestamp is
      // accurate relative to the actual signing moment.
      await logEvent({
        eventType: 'waiver.signed',
        sessionId: resolvedSessionId,
        waiverId,
        operatorId: engineData.operatorId,
        metadata: {
          activityKey:  full.activityKey,
          isMinor:      full.isMinor ?? false,
          clauseCount:  clauses.length,
        },
        ipAddress: ipAddressRef.current,
      })

      // 5. Seal the document
      try {
        const sealResult = await sealWaiver(supabase, {
          waiverId,
          fullName:      full.fullName,
          email:         full.email,
          dob:           full.dob,
          activityKey:   full.activityKey,
          activityLabel: labels[full.activityKey] ?? full.activityKey,
          signedAt,
          ipAddress:     ipAddressRef.current,
          isMinor:       full.isMinor ?? false,
          guardianName:  full.guardianName ?? null,
          clauses,
          signatureData: sigData,
        })

        const { error: hashWriteError } = await supabase
          .from('waivers')
          .update({ document_hash: sealResult.documentHash, pdf_url: sealResult.pdfUrl })
          .eq('id', waiverId)

        if (hashWriteError) {
          console.error('[attemptSave] hash write-back failed:', hashWriteError.message)
        }

        // ── Event 5: document.sealed ────────────────────────────────────────
        // Only logged if sealing actually succeeded.
        await logEvent({
          eventType: 'document.sealed',
          sessionId: resolvedSessionId,
          waiverId,
          operatorId: engineData.operatorId,
          metadata: {
            hashPreview: `${sealResult.documentHash.slice(0, 4)}…${sealResult.documentHash.slice(-4)}`,
            hasPdf:      true,
          },
          ipAddress: ipAddressRef.current,
        })
      } catch (sealErr) {
        console.error('[attemptSave] sealing failed (waiver saved, seal pending):', sealErr)
        // No document.sealed event — WaiverDetail will show it as pending,
        // which is accurate.
      }

      // SUCCESS
      setSaveState({ kind: 'idle' })
      setPendingSignature(null)
      setStep(7)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[handleSign] save failed:', message)

      const previousAttempts = saveState.kind === 'retryable_error' ? saveState.attempts : 0
      const newAttempts      = previousAttempts + 1

      if (newAttempts >= 3) {
        setSaveState({ kind: 'fatal_error' })
      } else {
        setSaveState({ kind: 'retryable_error', attempts: newAttempts, lastError: message })
      }
    }
  }

  function handleSign(sigData: string) {
    setPendingSignature(sigData)
    attemptSave(sigData)
  }

  function retrySave() {
    if (pendingSignature) attemptSave(pendingSignature)
  }

  function restart() {
    setStep(0)
    setAnswers({})
    setClauses([])
    setSaveState({ kind: 'idle' })
    setPendingSignature(null)
    resolvedSessionIdRef.current = null
  }

  const saving = saveState.kind === 'saving'

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <PageNav badge="Participant" operatorName="Desert Ridge Adventures" operatorAccent="#4B2ACF" />
      <div className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-lg">
          {step > 0 && step < 7 && (
            <>
              <div className="flex items-center gap-2 mb-2 text-xs text-muted">
                <span className="font-semibold text-brand tracking-widest uppercase" style={{ letterSpacing:'0.12em' }}>Adaptive waiver</span>
                <span className="text-gray-300">·</span>
                <span>Generated by LIABL Document Intelligence</span>
              </div>
              <ProgressBar steps={stepLabels} current={Math.min(step - 1, stepLabels.length - 1)} />
            </>
          )}

          <div className="animate-fade-up" key={step}>
            {step === 0 && <StepEntry     onNext={() => next()} />}
            {step === 1 && <StepIdentity  onNext={(v) => next(v)} onBack={prev} />}
            {step === 2 && <StepActivity  activities={engineData?.activities ?? []} onNext={(v) => next(v)} onBack={prev} />}
            {step === 3 && <StepHealth    onNext={(v) => next(v)} onBack={prev} answers={answers} labels={labels} />}
            {step === 4 && isMinor && (
              <StepGuardian minorName={answers.fullName ?? 'Minor'}
                onNext={(v) => { setAnswers(a => ({...a,...v})); setStep(5) }}
                onBack={prev} />
            )}
            {/* StepDocument now calls onDocumentProceed instead of setStep(6) directly,
                so we can log document.viewed before advancing */}
            {step === 5 && (
              <StepDocument
                clauses={clauses}
                answers={answers as ParticipantAnswers}
                labels={labels}
                onNext={onDocumentProceed}
                onBack={prev}
              />
            )}
            {step === 6 && (
              <>
                <StepSignature onSign={handleSign} onBack={prev} saving={saving} />

                {saveState.kind === 'retryable_error' && (
                  <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-amber-700 text-lg">⚠️</span>
                      <div className="flex-1">
                        <div className="font-semibold text-amber-900 text-sm mb-1">
                          We couldn&apos;t save your waiver.
                        </div>
                        <p className="text-amber-800 text-sm mb-3">
                          Please try again, or ask a staff member for help.
                        </p>
                        <button onClick={retrySave} className="btn-primary text-sm">Try again</button>
                        <p className="text-xs text-amber-700 mt-2">Attempt {saveState.attempts} of 3</p>
                      </div>
                    </div>
                  </div>
                )}

                {saveState.kind === 'fatal_error' && (
                  <div className="mt-4 bg-red-50 border border-red-300 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-red-700 text-lg">🚨</span>
                      <div className="flex-1">
                        <div className="font-semibold text-red-900 text-sm mb-1">
                          We&apos;re having trouble saving your waiver.
                        </div>
                        <p className="text-red-800 text-sm">
                          Please find a staff member and they&apos;ll get you sorted out.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {step === 7 && <StepConfirm answers={answers as ParticipantAnswers} labels={labels} onRestart={restart} />}
          </div>
        </div>
      </div>
    </div>
  )
}
