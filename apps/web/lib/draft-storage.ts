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

export interface DraftState {
  step: number
  answers: Partial<ParticipantAnswers>
  savedAt: string   // ISO timestamp
}

const DRAFT_TTL_MS = 30 * 60 * 1000   // 30 minutes — generous for a dropped-connection reload, short enough that it won't realistically span two different participants' visits

function draftKey(sessionId: string): string {
  return `liabl:draft:${sessionId}`
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
