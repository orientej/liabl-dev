'use client'
// Multi-document check-in — the supplemental-document loop.
//
// Runs AFTER the liability waiver is signed and sealed (ParticipantFlow
// enters this once resolveApplicableDocuments returns a non-empty list).
// For each applicable document, in order: review -> sign -> (for a minor,
// depending on the operator's guardian-signature mode) guardian sign ->
// seal + record. Required documents must be signed; optional ones can be
// skipped. When the queue is exhausted, onComplete() advances the check-in
// to the confirmation screen.
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import StepSignature from '@/components/participant/StepSignature'
import { StepGuardian } from '@/components/participant/StepGuardian'
import { sealAndRecordSignedDocument, renderDocumentBody, type ResolvedDocument } from '@/lib/signed-documents'

export interface DocumentSigningContext {
  waiverId:                   string
  operatorId:                 string
  participantId:              string
  participantName:            string
  email:                      string
  activityLabel:              string
  ipAddress:                  string | null
  isMinor:                    boolean
  guardianName:               string | null   // from the waiver (used in 'single' mode)
  guardianSignatureData:      string | null   // from the waiver (used in 'single' mode)
  minorGuardianSignatureMode: 'per_document' | 'single'
}

interface Props {
  documents: ResolvedDocument[]
  supabase:  SupabaseClient
  context:   DocumentSigningContext
  onComplete: () => void
}

type SubStep = 'review' | 'sign' | 'guardian'

export default function DocumentSigningFlow({ documents, supabase, context, onComplete }: Props) {
  const [index,          setIndex]          = useState(0)
  const [subStep,        setSubStep]        = useState<SubStep>('review')
  const [pendingSig,     setPendingSig]     = useState<string | null>(null)
  const [busy,           setBusy]           = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const doc  = documents[index]
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const renderedBody = doc ? renderDocumentBody(doc.body, { name: context.participantName, activity: context.activityLabel, date }) : ''

  // Advances to the next document, or finishes the check-in.
  function advance() {
    setPendingSig(null)
    setError(null)
    if (index + 1 >= documents.length) {
      onComplete()
    } else {
      setIndex(index + 1)
      setSubStep('review')
    }
  }

  async function record(signatureData: string, guardianSig: string | null, guardianName: string | null) {
    if (!doc) return
    setBusy(true)
    setError(null)
    try {
      await sealAndRecordSignedDocument(supabase, {
        waiverId:              context.waiverId,
        documentTemplateId:    doc.templateId,
        documentVersionId:     doc.versionId,
        operatorId:            context.operatorId,
        participantId:         context.participantId,
        documentKey:           doc.key,
        title:                 doc.title,
        renderedBody,
        participantName:       context.participantName,
        email:                 context.email,
        activityLabel:         context.activityLabel,
        signedAt:              new Date().toISOString(),
        ipAddress:             context.ipAddress,
        isMinor:               context.isMinor,
        guardianName:          context.isMinor ? guardianName : null,
        signatureData,
        guardianSignatureData: context.isMinor ? guardianSig : null,
      })
      advance()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this document. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function onParticipantSign(sig: string) {
    // Minors: a per-document operator collects a fresh guardian signature
    // for each document; a 'single' operator reuses the one captured on
    // the waiver, so we can seal immediately.
    if (context.isMinor && context.minorGuardianSignatureMode === 'per_document') {
      setPendingSig(sig)
      setSubStep('guardian')
      return
    }
    record(sig, context.guardianSignatureData, context.guardianName)
  }

  function onGuardianSign(v: { guardianName: string; guardianSig: string }) {
    if (!pendingSig) return
    record(pendingSig, v.guardianSig, v.guardianName)
  }

  function skipOptional() {
    if (!doc || doc.required) return
    advance()
  }

  if (!doc) return null

  const counter = `Document ${index + 1} of ${documents.length}`

  return (
    <div>
      {subStep === 'review' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className="font-semibold text-brand tracking-widest uppercase">{counter}</span>
            {!doc.required && (
              <span className="text-gray-400 border border-black/10 rounded-full px-2 py-0.5">Optional</span>
            )}
          </div>
          <h2 className="font-serif text-2xl mb-4" style={{ letterSpacing: '-0.01em' }}>{doc.title}</h2>
          <div className="max-h-72 overflow-y-auto space-y-3 pr-1 mb-5 text-sm leading-relaxed text-gray-600 whitespace-pre-line">
            {renderedBody || <span className="text-gray-400">This document has no content.</span>}
          </div>
          <div className="flex gap-3">
            {!doc.required && (
              <button onClick={skipOptional} className="btn-secondary" disabled={busy}>Skip</button>
            )}
            <button onClick={() => setSubStep('sign')} className="btn-primary" disabled={busy}>
              Continue to sign ✍️
            </button>
          </div>
        </div>
      )}

      {subStep === 'sign' && (
        <>
          <StepSignature onSign={onParticipantSign} onBack={() => setSubStep('review')} saving={busy} />
          {error && (
            <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900">
              <div className="font-semibold mb-1">We couldn&apos;t save this document.</div>
              <p className="text-amber-800 mb-2">Please try signing again, or ask a staff member for help.</p>
              <p className="text-xs text-amber-700 font-mono bg-amber-100/60 rounded-lg px-2 py-1.5 break-words">{error}</p>
            </div>
          )}
        </>
      )}

      {subStep === 'guardian' && (
        <>
          <StepGuardian
            minorName={context.participantName}
            onNext={onGuardianSign}
            onBack={() => setSubStep('sign')}
          />
          {error && (
            <div className="mt-4 bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm text-amber-900">
              <div className="font-semibold mb-1">We couldn&apos;t save this document.</div>
              <p className="text-amber-800 mb-2">Please try again, or ask a staff member for help.</p>
              <p className="text-xs text-amber-700 font-mono bg-amber-100/60 rounded-lg px-2 py-1.5 break-words">{error}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
