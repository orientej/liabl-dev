// lib/draft-storage.ts
// v25 M6 — session recovery: survive a page reload or dropped connection
// mid-flow without losing already-completed steps.
//
// Critical constraint this whole design is built around: this is a SHARED
// TABLET at a physical check-in station. One sessionId (e.g. "AM-04 kayak
// tour") covers an entire group — many different people sign against the
// same session throughout the morning, on the same device. Naively
// persisting by sessionId alone and silently restoring on next load would
// risk showing Participant B the tablet with Participant A's name, health
// disclosures, and answers already filled in — a real privacy problem, not
// just a UX glitch.
//
// The fix: persistence is real, but resuming is never silent. Whoever
// picks up the tablet next sees an explicit "resume Jane Doe's waiver
// from a few minutes ago, or start fresh?" prompt with the stored
// person's name visible — so a genuinely returning participant recognizes
// their own progress and resumes, while anyone else immediately sees it
// isn't theirs and starts clean. A hard TTL backs this up: drafts older
// than DRAFT_TTL_MS are discarded outright, no prompt at all, since at
// that point it's overwhelmingly more likely to be an abandoned attempt
// than someone still mid-signup.

import type { ParticipantAnswers } from '@/lib/document-engine'
import type { DocumentSigningContext } from '@/lib/signed-documents'

// Multi-document check-in: state for resuming the supplemental-document
// loop after the waiver is already signed. When present, the resume prompt
// offers to continue at the outstanding documents rather than re-signing.
export interface DocumentsPhaseState {
  checkInCtx:    DocumentSigningContext
  completedKeys: string[]   // document keys already signed or skipped
}

export interface DraftState {
  step: number
  answers: Partial<ParticipantAnswers>
  savedAt: string   // ISO timestamp
  // Set only after the waiver is signed and there are documents still to
  // sign — see saveDocumentsPhase. Absent for an ordinary pre-waiver draft.
  documentsPhase?: DocumentsPhaseState
}

const DRAFT_TTL_MS = 30 * 60 * 1000   // 30 minutes — generous for a dropped-connection reload, short enough that it won't realistically span two different participants' visits

function draftKey(sessionId: string): string {
  return `liabl:draft:${sessionId}`
}

// ── Group check-in progress (Phase 3) ──────────────────────────────────
// A group leader signing for their whole party on one device. Stored under
// a SEPARATE key so the per-person draft (which is saved/cleared each
// person) never clobbers the running group count. Longer TTL — a group
// check-in legitimately spans a while.
const GROUP_TTL_MS = 4 * 60 * 60 * 1000   // 4 hours

export interface GroupProgress { signedCount: number; target: number | null }

function groupKey(sessionId: string): string {
  return `liabl:group:${sessionId}`
}

export function saveGroupProgress(sessionId: string, progress: GroupProgress): void {
  try {
    localStorage.setItem(groupKey(sessionId), JSON.stringify({ ...progress, savedAt: new Date().toISOString() }))
  } catch { /* non-fatal, same as saveDraft */ }
}

/** Returns the group progress if present and within TTL, else null (and
 *  clears an expired one). Only meaningful once at least one person has
 *  been signed — the count is what makes a resume worth offering. */
export function loadGroupProgress(sessionId: string): GroupProgress | null {
  try {
    const raw = localStorage.getItem(groupKey(sessionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as GroupProgress & { savedAt?: string }
    const age = parsed.savedAt ? Date.now() - new Date(parsed.savedAt).getTime() : 0
    if (!(age >= 0) || age > GROUP_TTL_MS || !parsed.signedCount) {
      clearGroupProgress(sessionId)
      return null
    }
    return { signedCount: parsed.signedCount, target: parsed.target ?? null }
  } catch {
    return null
  }
}

export function clearGroupProgress(sessionId: string): void {
  try { localStorage.removeItem(groupKey(sessionId)) } catch { /* nothing to do */ }
}

export function saveDraft(sessionId: string, step: number, answers: Partial<ParticipantAnswers>): void {
  try {
    const draft: DraftState = { step, answers, savedAt: new Date().toISOString() }
    localStorage.setItem(draftKey(sessionId), JSON.stringify(draft))
  } catch {
    // localStorage can throw (private/incognito mode, quota exceeded,
    // disabled entirely) — non-fatal. It just means no recovery is
    // available if this device reloads, same as before this feature
    // existed at all.
  }
}

/** Persists the documents-phase state so a reload mid-loop can resume at
 *  the outstanding documents instead of re-signing the waiver. Overwrites
 *  the pre-waiver draft for this session (same key) — by this point the
 *  waiver is signed, so the pre-waiver draft is no longer meaningful.
 *  answers is kept only so the resume prompt can show whose check-in it is. */
export function saveDocumentsPhase(
  sessionId: string,
  answers: Partial<ParticipantAnswers>,
  documentsPhase: DocumentsPhaseState,
): void {
  try {
    const draft: DraftState = { step: 8, answers, savedAt: new Date().toISOString(), documentsPhase }
    localStorage.setItem(draftKey(sessionId), JSON.stringify(draft))
  } catch { /* non-fatal, same as saveDraft */ }
}

/** Returns null if there's no draft, it's malformed, or it's past the TTL
 * (in which case it's also cleared, so callers don't need to). Does NOT
 * decide whether to actually resume — that's an explicit choice made by
 * the person looking at the screen, via a confirm prompt showing whose
 * name is on it. */
export function loadDraft(sessionId: string): DraftState | null {
  try {
    const raw = localStorage.getItem(draftKey(sessionId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as DraftState
    const age = Date.now() - new Date(parsed.savedAt).getTime()
    if (!(age >= 0) || age > DRAFT_TTL_MS) {
      clearDraft(sessionId)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearDraft(sessionId: string): void {
  try {
    localStorage.removeItem(draftKey(sessionId))
  } catch {
    // Nothing to do — if we can't read/write localStorage at all, there
    // was never anything to clear in the first place.
  }
}
