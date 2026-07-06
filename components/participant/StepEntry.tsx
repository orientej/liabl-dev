interface Props { onNext: () => void }
export default function StepEntry({ onNext }: Props) {
  return (
    <div className="card">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Desert Ridge Adventures</p>
      <h2 className="font-serif text-3xl mb-2" style={{ letterSpacing:'-0.01em' }}>Welcome, Adventurer.</h2>
      <p className="text-gray-500 text-sm mb-6 leading-relaxed">Please complete your Liability Waiver before your 9:00 AM session.</p>
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 flex gap-3 items-start mb-6 text-sm text-brand">
        <span>🔒</span><span>Your information is encrypted and securely stored.</span>
      </div>
      <button onClick={onNext} className="btn-primary">Start Waiver →</button>
    </div>
  )
}
