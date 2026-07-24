'use client'
import { useState } from 'react'
import type { QuestionRecord } from '@/lib/document-engine'

interface Props {
  onNext: (v: { questionResponses: Record<string, string>; healthStatus: string[] }) => void
  onBack: () => void
  answers: Partial<{ activityKey: string }>
  labels: Record<string, string>
  questions: QuestionRecord[]
  // question.id -> the clause title it triggers, for a specific warning
  // message rather than a generic one. Only questions with
  // triggersClause=true will have an entry here.
  clauseTitleByQuestionId: Record<string, string>
}

// v25 fix — this component used to render two hardcoded checkboxes
// (cardiac/injury) regardless of what an operator actually configured in
// TemplateTab. It now renders whatever questions are actually assigned
// to this operator/activity — any type (yes_no, multiple, text), any
// count, any wording — collecting real per-question answers instead of
// a fixed pair of booleans. See lib/document-engine.ts's
// ParticipantAnswers/generateClauses for the matching half of this fix.
export default function StepHealth({ onNext, onBack, answers, labels, questions, clauseTitleByQuestionId }: Props) {
  const [responses, setResponses] = useState<Record<string, string>>({})
  const actLabel = answers.activityKey ? (labels[answers.activityKey] ?? 'your activity') : 'your activity'

  const yesNoQuestions = questions.filter(q => q.type === 'yes_no')
  const otherQuestions  = questions.filter(q => q.type !== 'yes_no')

  function setResponse(questionId: string, value: string) {
    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  function toggleYesNo(question: QuestionRecord) {
    const current = responses[question.id]
    const triggerValue = question.triggerValue || 'yes'
    setResponses(prev => {
      const next = { ...prev }
      if (current === triggerValue) delete next[question.id] // unchecking clears the answer entirely
      else next[question.id] = triggerValue
      return next
    })
  }

  function clearAllYesNo() {
    setResponses(prev => {
      const next = { ...prev }
      for (const q of yesNoQuestions) delete next[q.id]
      return next
    })
  }

  const noneOfYesNoSelected = yesNoQuestions.every(q => responses[q.id] === undefined)

  // Required: any non-yes_no question needs a real answer before
  // continuing — a yes_no question left unchecked is itself a valid
  // "no" answer, so those never block continuation.
  const requiredAnswered = otherQuestions.every(q => {
    const v = responses[q.id]
    return v !== undefined && v.trim() !== ''
  })

  function submit() {
    if (!requiredAnswered) return
    // healthStatus is kept only for RiskScore.tsx's existing risk-scoring
    // logic, which just wants "how many concerning things were flagged" —
    // a list of the triggered clause titles satisfies that without
    // needing RiskScore.tsx to know anything about question IDs.
    const healthStatus = Object.entries(responses)
      .map(([qId]) => clauseTitleByQuestionId[qId])
      .filter((title): title is string => Boolean(title))
    onNext({ questionResponses: responses, healthStatus })
  }

  if (questions.length === 0) {
    // No health/adaptive questions configured for this operator/activity
    // at all — don't show an empty step, just let the participant
    // through. A missing question set isn't an error state.
    return (
      <div className="card">
        <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 3 of 5 · Adaptive questions</p>
        <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Health &amp; experience</h2>
        <p className="text-gray-500 text-sm mb-6">No additional questions for <span className="text-brand font-medium">{actLabel}</span>.</p>
        <div className="flex gap-3 mt-4">
          <button onClick={onBack} className="btn-secondary">← Back</button>
          <button onClick={() => onNext({ questionResponses: {}, healthStatus: [] })} className="btn-primary">Review document →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 3 of 5 · Adaptive questions</p>
      <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Health &amp; experience</h2>
      <p className="text-gray-500 text-sm mb-6">Adapting your waiver for <span className="text-brand font-medium">{actLabel}</span> in real time.</p>

      {yesNoQuestions.length > 0 && (
        <div className="space-y-2 mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">
            Select all that apply. The waiver will adapt based on your selections.
          </label>

          <button
            onClick={clearAllYesNo}
            className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
              noneOfYesNoSelected ? 'border-brand bg-brand/5' : 'border-black/10 bg-surface hover:border-brand/40'
            }`}
          >
            <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
              noneOfYesNoSelected ? 'border-brand bg-brand' : 'border-gray-300'
            }`}>
              {noneOfYesNoSelected && <span className="text-white text-[10px] leading-none">✓</span>}
            </span>
            <span className="text-sm">None of the below apply to me</span>
          </button>

          {yesNoQuestions.map(q => {
            const checked = responses[q.id] !== undefined
            return (
              <button
                key={q.id}
                onClick={() => toggleYesNo(q)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  checked ? 'border-brand bg-brand/5' : 'border-black/10 bg-surface hover:border-brand/40'
                }`}
              >
                <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                  checked ? 'border-brand bg-brand' : 'border-gray-300'
                }`}>
                  {checked && <span className="text-white text-[10px] leading-none">✓</span>}
                </span>
                <span className="text-sm">{q.text}</span>
              </button>
            )
          })}
        </div>
      )}

      {otherQuestions.map(q => (
        <div key={q.id} className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">{q.text}</label>
          {q.type === 'multiple' ? (
            <div className="flex flex-wrap gap-2">
              {(q.options ?? []).map(option => (
                <button
                  key={option}
                  onClick={() => setResponse(q.id, option)}
                  className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                    responses[q.id] === option ? 'border-brand bg-brand/5 text-brand' : 'border-black/10 bg-surface hover:border-brand/40'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <input
              className="form-input"
              value={responses[q.id] ?? ''}
              onChange={e => setResponse(q.id, e.target.value)}
              placeholder="Your answer"
            />
          )}
        </div>
      ))}

      {/* Per-question warning panels — one shown per question currently
          answered in a way that triggers its clause. */}
      {questions.map(q => {
        const triggered = q.triggersClause && responses[q.id] === q.triggerValue
        if (!triggered) return null
        const clauseTitle = clauseTitleByQuestionId[q.id]
        return (
          <div key={q.id} className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-sm mb-2">
            ⚠️ <strong>{clauseTitle ? `${clauseTitle} will be added to your waiver.` : 'An additional clause will be added to your waiver.'}</strong>
          </div>
        )
      })}

      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="btn-secondary">← Back</button>
        <button onClick={submit} disabled={!requiredAnswered} className="btn-primary">Review document →</button>
      </div>
    </div>
  )
}
