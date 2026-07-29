// lib/document-templates.ts
// Multi-Document Check-In — operator authoring of supplemental documents
// (photo release, code of conduct, …).
//
// Mirrors the activities model: document_templates is the mutable draft;
// publishing snapshots it into document_template_versions and points the
// template at that version (same shape as lib/template-versions.ts's
// publishTemplateVersion). All reads/writes here are operator-scoped by
// RLS via the authenticated client — same posture as lib/activity-admin.ts
// and lib/template-versions.ts.

import { createClient } from '@/lib/supabase'

export interface DocumentTemplateRecord {
  id:                   string
  key:                  string
  title:                string
  body:                 string
  required:             boolean
  appliesTo:            'all' | 'activities'
  sortOrder:            number
  currentVersionId:     string | null
  currentVersionNumber: number | null
  hasDraftChanges:      boolean
  archivedAt:           string | null
  activityIds:          string[]   // only meaningful when appliesTo === 'activities'
}

export interface DocumentSnapshot {
  title:        string
  body:         string
  required:     boolean
  appliesTo:    'all' | 'activities'
  activityKeys: string[]
}

export interface DocumentTemplateVersion {
  id:               string
  documentTemplateId: string
  versionNumber:    number
  snapshot:         DocumentSnapshot
  changeNote:       string | null
  publishedByEmail: string | null
  publishedAt:      string
}

/** Lists an operator's document templates (including unpublished drafts),
 *  newest-authored influence by sort order, with their applicability sets. */
export async function listDocumentTemplates(operatorId: string): Promise<DocumentTemplateRecord[]> {
  const supabase = createClient()

  const [{ data: templates, error }, { data: applies }] = await Promise.all([
    supabase
      .from('document_templates')
      .select('id, key, title, body, required, applies_to, sort_order, current_version_id, current_version_number, has_draft_changes, archived_at')
      .eq('operator_id', operatorId)
      .order('sort_order'),
    supabase
      .from('document_template_activities')
      .select('document_template_id, activity_id')
      .eq('operator_id', operatorId),
  ])

  if (error) throw new Error(`list document templates: ${error.message}`)

  const activityIdsByTemplate = new Map<string, string[]>()
  for (const row of applies ?? []) {
    const list = activityIdsByTemplate.get(row.document_template_id) ?? []
    list.push(row.activity_id)
    activityIdsByTemplate.set(row.document_template_id, list)
  }

  return (templates ?? []).map(t => ({
    id:                   t.id,
    key:                  t.key,
    title:                t.title,
    body:                 t.body,
    required:             t.required,
    appliesTo:            t.applies_to,
    sortOrder:            t.sort_order,
    currentVersionId:     t.current_version_id ?? null,
    currentVersionNumber: t.current_version_number ?? null,
    hasDraftChanges:      t.has_draft_changes,
    archivedAt:           t.archived_at ?? null,
    activityIds:          activityIdsByTemplate.get(t.id) ?? [],
  }))
}

export interface CreateDocumentTemplateInput {
  operatorId: string
  key:        string
  title:      string
  body?:      string
  required?:  boolean
}

export async function createDocumentTemplate(input: CreateDocumentTemplateInput): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('document_templates')
    .insert({
      operator_id: input.operatorId,
      key:         input.key.trim(),
      title:       input.title.trim(),
      body:        input.body ?? '',
      required:    input.required ?? true,
    })
    .select('id')
    .single()

  if (error) {
    if (error.message.toLowerCase().includes('duplicate') || error.code === '23505') {
      throw new Error(`A document with key "${input.key}" already exists for this operator.`)
    }
    throw new Error(`create document template: ${error.message}`)
  }
  if (!data) throw new Error('create document template returned no data')
  return data.id
}

export interface UpdateDocumentTemplateInput {
  title?:     string
  body?:      string
  required?:  boolean
  appliesTo?: 'all' | 'activities'
  sortOrder?: number
}

/** Updates draft fields and flags the template as having unpublished
 *  changes, so the version panel shows "unpublished changes" and enables
 *  Publish — same contract as markDraftChanged for activities. */
export async function updateDocumentTemplate(id: string, patch: UpdateDocumentTemplateInput): Promise<void> {
  const supabase = createClient()
  const update: Record<string, unknown> = { has_draft_changes: true }
  if (patch.title     !== undefined) update.title      = patch.title.trim()
  if (patch.body      !== undefined) update.body       = patch.body
  if (patch.required  !== undefined) update.required   = patch.required
  if (patch.appliesTo !== undefined) update.applies_to = patch.appliesTo
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder

  const { error } = await supabase.from('document_templates').update(update).eq('id', id)
  if (error) throw new Error(`update document template: ${error.message}`)
}

/** Replaces the per-activity applicability set for a document. Only
 *  meaningful when the document's applies_to = 'activities'. */
export async function setDocumentTemplateActivities(
  documentTemplateId: string,
  operatorId: string,
  activityIds: string[],
): Promise<void> {
  const supabase = createClient()

  const { error: delErr } = await supabase
    .from('document_template_activities')
    .delete()
    .eq('document_template_id', documentTemplateId)
  if (delErr) throw new Error(`clear document applicability: ${delErr.message}`)

  if (activityIds.length > 0) {
    const rows = activityIds.map(activity_id => ({
      document_template_id: documentTemplateId,
      activity_id,
      operator_id: operatorId,
    }))
    const { error: insErr } = await supabase.from('document_template_activities').insert(rows)
    if (insErr) throw new Error(`set document applicability: ${insErr.message}`)
  }

  // Applicability change is a draft change too.
  await supabase.from('document_templates').update({ has_draft_changes: true }).eq('id', documentTemplateId)
}

export async function setDocumentTemplateArchived(id: string, archived: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('document_templates')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(`${archived ? 'archive' : 'restore'} document template: ${error.message}`)
}

export async function markDocumentDraftChanged(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('document_templates').update({ has_draft_changes: true }).eq('id', id)
  if (error) throw new Error(`mark document draft changed: ${error.message}`)
}

/** Builds the immutable snapshot from the current draft — the document's
 *  own fields plus the resolved activity KEYS (not ids), so the snapshot
 *  is self-contained and independent of the mutable applicability rows. */
async function buildDocumentSnapshot(operatorId: string, documentTemplateId: string): Promise<DocumentSnapshot> {
  const supabase = createClient()

  const { data: doc, error } = await supabase
    .from('document_templates')
    .select('title, body, required, applies_to')
    .eq('id', documentTemplateId)
    .maybeSingle()
  if (error) throw new Error(`snapshot document: ${error.message}`)
  if (!doc) throw new Error('snapshot: document template not found')

  let activityKeys: string[] = []
  if (doc.applies_to === 'activities') {
    const { data: applies } = await supabase
      .from('document_template_activities')
      .select('activities(key)')
      .eq('document_template_id', documentTemplateId)
    activityKeys = (applies ?? [])
      .map(r => {
        const a = Array.isArray(r.activities) ? r.activities[0] : r.activities
        return a?.key as string | undefined
      })
      .filter((k): k is string => !!k)
  }

  return {
    title:        doc.title,
    body:         doc.body,
    required:     doc.required,
    appliesTo:    doc.applies_to,
    activityKeys,
  }
}

export interface PublishDocumentInput {
  operatorId:         string
  documentTemplateId: string
  changeNote?:        string
}

/** Publishes the document's current draft as a new immutable version. */
export async function publishDocumentVersion(input: PublishDocumentInput): Promise<{ versionId: string; versionNumber: number }> {
  const supabase = createClient()

  const { data: docRow, error: docErr } = await supabase
    .from('document_templates')
    .select('current_version_number')
    .eq('id', input.documentTemplateId)
    .maybeSingle()
  if (docErr) throw new Error(`publish (read document): ${docErr.message}`)
  if (!docRow) throw new Error('publish: document template not found')

  const nextNumber = (docRow.current_version_number ?? 0) + 1
  const snapshot   = await buildDocumentSnapshot(input.operatorId, input.documentTemplateId)

  const { data: { user } } = await supabase.auth.getUser()

  const { data: version, error: insErr } = await supabase
    .from('document_template_versions')
    .insert({
      operator_id:          input.operatorId,
      document_template_id: input.documentTemplateId,
      version_number:       nextNumber,
      snapshot,
      change_note:          input.changeNote ?? null,
      published_by:         user?.id ?? null,
      published_by_email:   user?.email ?? null,
    })
    .select('id, version_number')
    .single()

  if (insErr) throw new Error(`publish (insert version): ${insErr.message}`)
  if (!version) throw new Error('publish: insert returned no data')

  const { error: updErr } = await supabase
    .from('document_templates')
    .update({
      current_version_id:     version.id,
      current_version_number: version.version_number,
      has_draft_changes:      false,
    })
    .eq('id', input.documentTemplateId)
  if (updErr) throw new Error(`publish (update document): ${updErr.message}`)

  return { versionId: version.id as string, versionNumber: version.version_number as number }
}

/** Sets the operator's minor-guardian signature mode for supplemental
 *  documents ('per_document' or 'single'). Operator-scoped by RLS. */
export async function setMinorGuardianSignatureMode(
  operatorId: string,
  mode: 'per_document' | 'single',
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('operators')
    .update({ minor_guardian_signature_mode: mode })
    .eq('id', operatorId)
  if (error) throw new Error(`set guardian signature mode: ${error.message}`)
}

/** Full version history for a document template, newest first. */
export async function listDocumentVersions(documentTemplateId: string): Promise<DocumentTemplateVersion[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('document_template_versions')
    .select('id, document_template_id, version_number, snapshot, change_note, published_by_email, published_at')
    .eq('document_template_id', documentTemplateId)
    .order('version_number', { ascending: false })

  if (error) throw new Error(`list document versions: ${error.message}`)
  return (data ?? []).map(v => ({
    id:                 v.id,
    documentTemplateId: v.document_template_id,
    versionNumber:      v.version_number,
    snapshot:           v.snapshot as DocumentSnapshot,
    changeNote:         v.change_note,
    publishedByEmail:   v.published_by_email,
    publishedAt:        v.published_at,
  }))
}
