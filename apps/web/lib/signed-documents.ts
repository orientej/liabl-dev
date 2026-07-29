// lib/signed-documents.ts
// Multi-Document Check-In — participant-side resolution of which
// supplemental documents a check-in must sign, read from PUBLISHED
// snapshots via the anonymous client (same access path the participant
// flow uses for activities/clauses). The seal + PDF for each signed
// document is produced by sealSignedDocument in lib/seal.ts; the signed
// row is written through a service-role route (mirroring the waiver
// seal-writeback), wired up in the participant flow.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sealSignedDocument } from '@/lib/seal'

export interface ResolvedDocument {
  templateId: string
  versionId:  string
  key:        string
  title:      string
  body:       string      // published body, before per-participant variable substitution
  required:   boolean
  sortOrder:  number
}

/**
 * Returns the operator's published, non-archived supplemental documents
 * that apply to the given activity, in sort order. Content comes from the
 * PUBLISHED version snapshot (not the mutable draft), so a participant
 * only ever signs published text. Returns [] when the operator has no
 * applicable documents — the caller then behaves exactly as the
 * single-waiver flow always has.
 */
export async function resolveApplicableDocuments(
  supabase: SupabaseClient,
  operatorId: string,
  activityId: string,
): Promise<ResolvedDocument[]> {
  const { data: templates, error } = await supabase
    .from('document_templates')
    .select('id, key, applies_to, sort_order, current_version_id')
    .eq('operator_id', operatorId)
    .not('current_version_id', 'is', null)
    .is('archived_at', null)
    .order('sort_order')

  if (error) throw new Error(`resolve documents: ${error.message}`)
  if (!templates || templates.length === 0) return []

  // Which activity-scoped templates apply to THIS activity.
  const activityScopedIds = templates.filter(t => t.applies_to === 'activities').map(t => t.id)
  const applicableActivityScoped = new Set<string>()
  if (activityScopedIds.length > 0) {
    const { data: applies, error: aErr } = await supabase
      .from('document_template_activities')
      .select('document_template_id')
      .eq('activity_id', activityId)
      .in('document_template_id', activityScopedIds)
    if (aErr) throw new Error(`resolve document applicability: ${aErr.message}`)
    for (const row of applies ?? []) applicableActivityScoped.add(row.document_template_id)
  }

  const applicable = templates.filter(t =>
    t.applies_to === 'all' || applicableActivityScoped.has(t.id)
  )
  if (applicable.length === 0) return []

  // Read the published snapshot for each applicable template.
  const versionIds = applicable.map(t => t.current_version_id as string)
  const { data: versions, error: vErr } = await supabase
    .from('document_template_versions')
    .select('id, snapshot')
    .in('id', versionIds)
  if (vErr) throw new Error(`resolve document versions: ${vErr.message}`)

  const snapshotByVersionId = new Map<string, any>()
  for (const v of versions ?? []) snapshotByVersionId.set(v.id, v.snapshot)

  const resolved: ResolvedDocument[] = []
  for (const t of applicable) {
    const snapshot = snapshotByVersionId.get(t.current_version_id as string)
    if (!snapshot) continue   // published id with no readable snapshot — skip rather than sign blank
    resolved.push({
      templateId: t.id,
      versionId:  t.current_version_id as string,
      key:        t.key,
      title:      snapshot.title ?? '',
      body:       snapshot.body ?? '',
      required:   snapshot.required ?? true,
      sortOrder:  t.sort_order,
    })
  }

  resolved.sort((a, b) => a.sortOrder - b.sortOrder)
  return resolved
}

/** Substitutes {{name}}/{{activity}}/{{date}} in a document body — the
 *  same variable set and syntax as clause bodies (document-engine's
 *  renderTemplate), so operators author documents and clauses the same way. */
export function renderDocumentBody(
  body: string,
  vars: { name: string; activity: string; date: string },
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => (vars as Record<string, string>)[key] ?? '')
}

export interface RecordSignedDocumentParams {
  waiverId:              string
  documentTemplateId:    string
  documentVersionId:     string
  operatorId:            string
  participantId:         string
  documentKey:           string
  title:                 string
  renderedBody:          string   // body with {{vars}} already substituted
  participantName:       string
  email:                 string
  activityLabel:         string
  signedAt:              string
  ipAddress:             string | null
  isMinor:               boolean
  guardianName:          string | null
  signatureData:         string
  guardianSignatureData: string | null
}

/**
 * Records one signed supplemental document for a check-in: inserts the
 * signed_documents row (anonymous client, client-generated UUID, no
 * select-back — same posture as the waiver insert), seals it into its own
 * PDF, and writes the hash/pdf_path back through the service-role route.
 *
 * Mirrors ParticipantFlow.attemptSave's waiver handling: the row is
 * inserted first and is a valid signature on its own, so a sealing
 * failure is recorded as seal_error rather than thrown — the document is
 * still signed, its PDF just needs re-generation, exactly like a waiver
 * whose seal failed. Returns whether sealing succeeded.
 */
export async function sealAndRecordSignedDocument(
  supabase: SupabaseClient,
  params: RecordSignedDocumentParams,
): Promise<{ id: string; sealed: boolean }> {
  const id = crypto.randomUUID()

  const { error: insertError } = await supabase
    .from('signed_documents')
    .insert({
      id,
      waiver_id:               params.waiverId,
      document_template_id:    params.documentTemplateId,
      document_version_id:     params.documentVersionId,
      operator_id:             params.operatorId,
      participant_id:          params.participantId,
      title_snapshot:          params.title,
      body_snapshot:           params.renderedBody,
      signature_data:          params.signatureData,
      is_minor:                params.isMinor,
      guardian_name:           params.guardianName,
      guardian_signature_data: params.guardianSignatureData,
      signed_at:               params.signedAt,
      ip_address:              params.ipAddress,
    })

  if (insertError) throw new Error(`signed_document insert: ${insertError.message}`)

  try {
    const { documentHash, pdfPath } = await sealSignedDocument(supabase, {
      waiverId:              params.waiverId,
      documentKey:           params.documentKey,
      title:                 params.title,
      body:                  params.renderedBody,
      participantName:       params.participantName,
      email:                 params.email,
      activityLabel:         params.activityLabel,
      signedAt:              params.signedAt,
      ipAddress:             params.ipAddress,
      isMinor:               params.isMinor,
      guardianName:          params.guardianName,
      signatureData:         params.signatureData,
      guardianSignatureData: params.guardianSignatureData,
    })

    await fetch(`/api/signed-documents/${id}/seal-writeback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentHash, pdfPath }),
    }).catch(() => {})

    return { id, sealed: true }
  } catch (sealErr) {
    const message = sealErr instanceof Error ? sealErr.message : String(sealErr)
    // Same as the waiver seal-failure path: the signature stands, only the
    // sealed PDF is missing. Record it and move on rather than blocking.
    await fetch(`/api/signed-documents/${id}/seal-writeback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sealError: message }),
    }).catch(() => {})

    return { id, sealed: false }
  }
}
