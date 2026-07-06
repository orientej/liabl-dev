'use client'
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { IconUser, IconTemplate, IconAuditTrail, IconVerified, IconSigned, IconIntegration } from '@/components/icons'

type OnboardStep = 0|1|2|3|4

interface StepState {
  operatorName: string
  activity:     string
  questions:    string[]
  email:        string
  sent:         boolean
  signed:       boolean
}

const ACTIVITIES = ['Whitewater Kayaking','Canyon Hiking','ATV Tour','Rock Climbing','Yoga & Wellness','Cycling Tour']

export default function OnboardingTab() {
  const [step,     setStep]     = useState<OnboardStep>(0)
  const [state,    setState]    = useState<StepState>({
    operatorName:'', activity:'', questions:[], email:'', sent:false, signed:false,
  })
  const [animating, setAnimating] = useState(false)

  function advance(updates?: Partial<StepState>) {
    setAnimating(true)
    setState(s => ({ ...s, ...updates }))
    setTimeout(() => { setStep(s => (s + 1) as OnboardStep); setAnimating(false) }, 300)
  }

  function restart() { setStep(0); setState({ operatorName:'', activity:'', questions:[], email:'', sent:false, signed:false }) }

  const STEPS = [
    { label:'Create account',     Icon: IconUser,                  done: step > 0 },
    { label:'Configure activity', Icon: IconTemplate,              done: step > 1 },
    { label:'Invite participant', Icon: IconAuditTrail,            done: step > 2 },
    { label:'Watch it work',      Icon: IconVerified,              done: step > 3 },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl" style={{ letterSpacing:'-0.01em' }}>Getting Started</h1>
        <p className="text-sm text-gray-400 mt-1">Four steps from zero to your first signed waiver.</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 flex-1 ${i < step ? 'opacity-100' : i === step ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 transition-all ${
                s.done ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand text-white' : 'bg-surface border border-black/10 text-gray-400'
              }`}>
                {s.done ? <CheckCircle size={16} /> : <s.Icon size={16}/>}
              </div>
              {i < 3 && <div className={`flex-1 h-0.5 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-black/10'}`} />}
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className={`transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}>

        {/* Step 0 — Create account */}
        {step === 0 && (
          <div className="card">
            <div className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 1 of 4</div>
            <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Create your operator account</h2>
            <p className="text-gray-500 text-sm mb-6">Takes about 60 seconds. No credit card required to start.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Business Name</label>
                <input className="form-input" placeholder="e.g. Desert Ridge Adventures"
                  value={state.operatorName} onChange={e=>setState(s=>({...s,operatorName:e.target.value}))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Your Name</label>
                  <input className="form-input" placeholder="First Last"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Business Email</label>
                  <input className="form-input" type="email" placeholder="you@yourbusiness.com"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Industry</label>
                <select className="form-input">
                  <option>Outdoor adventure</option>
                  <option>Fitness & wellness</option>
                  <option>Youth programs</option>
                  <option>Tourism & recreation</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => advance({ operatorName: state.operatorName || 'Desert Ridge Adventures' })}
                className="btn-primary">
                Create account →
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Free 14-day trial · No credit card required</p>
          </div>
        )}

        {/* Step 1 — Configure activity */}
        {step === 1 && (
          <div className="card">
            <div className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 2 of 4</div>
            <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Configure your first activity</h2>
            <p className="text-gray-500 text-sm mb-6">
              Select an activity type. LIABL generates the base waiver clauses and adaptive questions automatically.
            </p>
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-2">Activity type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ACTIVITIES.map(a => (
                  <button key={a} onClick={() => setState(s => ({...s, activity:a}))}
                    className={`text-left p-3 rounded-xl border text-sm transition-all ${
                      state.activity===a ? 'border-brand bg-brand/5 text-brand font-medium' : 'border-black/10 bg-surface text-gray-600 hover:border-brand/30'
                    }`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            {state.activity && (
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 mb-5 animate-fade-up">
                <div className="text-xs font-semibold text-brand mb-2">Auto-generated for {state.activity}</div>
                <div className="space-y-1.5">
                  {['Assumption of Risk','Release of Liability','Equipment & Safety Briefing',`${state.activity} — Activity-Specific Hazards`].map(c=>(
                    <div key={c} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-brand shrink-0">✓</span>{c}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-xs text-brand font-medium">
                    <span className="shrink-0">⚡</span>+ Adaptive clauses based on health & experience answers
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="btn-secondary">← Back</button>
              <button onClick={() => advance()} disabled={!state.activity} className="btn-primary">
                Save activity template →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Invite participant */}
        {step === 2 && (
          <div className="card">
            <div className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 3 of 4</div>
            <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Invite your first participant</h2>
            <p className="text-gray-500 text-sm mb-6">
              Send a signing link by email, or share the QR code. Participants can sign from any device — no app required.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-surface border border-black/10 rounded-xl p-4">
                <div className="font-semibold text-sm text-ink mb-3">Option A — Email invite</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Participant email</label>
                    <input className="form-input" type="email" placeholder="participant@email.com"
                      value={state.email} onChange={e=>setState(s=>({...s,email:e.target.value}))}/>
                  </div>
                  <button
                    onClick={() => setState(s => ({...s, sent:true}))}
                    disabled={!state.email.includes('@')}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      state.sent ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-brand text-white hover:opacity-90 disabled:opacity-40'
                    }`}>
                    {state.sent ? '✓ Invite sent!' : 'Send signing link'}
                  </button>
                </div>
              </div>
              <div className="bg-surface border border-black/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <div className="font-semibold text-sm text-ink mb-2">Option B — QR code</div>
                <div className="w-24 h-24 bg-white border-2 border-black/10 rounded-xl flex items-center justify-center mb-2">
                  <div className="grid grid-cols-3 gap-0.5 opacity-60">
                    {Array.from({length:9}).map((_,i)=>(
                      <div key={i} className={`w-5 h-5 rounded-sm ${[0,2,6,8,4].includes(i)?'bg-ink':'bg-white border border-black/10'}`}/>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400">Print or display — participants scan to sign</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
              <button onClick={() => advance()} className="btn-primary">
                {state.sent ? 'Continue →' : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Watch it work */}
        {step === 3 && (
          <div className="card">
            <div className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 4 of 4</div>
            <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Watch it work.</h2>
            <p className="text-gray-500 text-sm mb-6">
              Simulate a participant completing their waiver to see exactly what appears in your dashboard.
            </p>
            <div className="space-y-3 mb-5">
              <div className="bg-surface border border-black/10 rounded-xl p-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${state.signed?'bg-emerald-50':'bg-brand/10'}`}>
                  <span>{state.signed?'✅':'✍️'}</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink">
                    {state.signed ? 'Jordan Rivera signed the waiver' : 'Waiting for participant to sign…'}
                  </div>
                  <div className="text-xs text-gray-400">
                    {state.signed ? `${state.operatorName || 'Desert Ridge Adventures'} · ${state.activity || 'Whitewater Kayaking'} · Just now` : 'Invite sent — link expires in 24 hours'}
                  </div>
                </div>
                {!state.signed && (
                  <button onClick={() => setState(s => ({...s, signed:true}))}
                    className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg font-medium hover:opacity-90 shrink-0">
                    Simulate sign
                  </button>
                )}
              </div>

              {state.signed && (
                <div className="animate-fade-up space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="font-semibold text-emerald-700 text-sm mb-1">✓ Waiver signed and verified</div>
                    <div className="text-xs text-emerald-600 space-y-0.5">
                      <div>SHA-256 hash recorded · ESIGN Act compliant</div>
                      <div>Participant appears in your roster · AI Risk Score: Low (24)</div>
                      <div>Email confirmation sent to participant</div>
                    </div>
                  </div>
                  <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 text-sm text-brand">
                    🎉 <strong>You&apos;re live.</strong> Jordan Rivera&apos;s waiver is in your operator dashboard right now. Ready to run your first session.
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
              {state.signed && (
                <button onClick={() => advance()} className="btn-primary">Go to dashboard →</button>
              )}
            </div>
          </div>
        )}

        {/* Step 4 — Complete */}
        {step === 4 && (
          <div className="card text-center animate-fade-up">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4 text-3xl">🎉</div>
            <h2 className="font-serif text-2xl mb-2" style={{ letterSpacing:'-0.01em' }}>
              {state.operatorName || 'Your business'} is live on LIABL.
            </h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
              Your first activity template is configured, your first waiver is signed and verified,
              and your operator dashboard is ready. That took about 90 seconds.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { Icon:IconSigned,      label:'View your roster',    href:'/operator',     color:'#4B2ACF' },
                { Icon:IconTemplate,    label:'Add more activities', href:'/operator',     color:'#EA580C' },
                { Icon:IconIntegration, label:'Connect FareHarbor',  href:'/integrations', color:'#059669' },
              ].map(({ Icon, label, href, color }) => (
                <a key={label} href={href}
                  className="bg-surface border border-black/10 rounded-xl p-4 text-center hover:border-brand/30 hover:bg-brand/5 transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto" style={{background:color}}>
                    <Icon size={20} color="#FFFFFF"/>
                  </div>
                  <div className="text-xs font-medium text-ink">{label}</div>
                </a>
              ))}
            </div>
            <button onClick={restart} className="text-sm text-gray-400 underline hover:text-ink">
              ↺ Restart demo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
