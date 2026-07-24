'use client'
import { IconAuditTrail, IconLIABLPass, IconRiskProfile, IconShield } from '@/components/icons'

const CARES = [
  { Icon:IconAuditTrail, title:'The right document gets generated automatically',
    body:'Operators running both ATV tours and kayak trips no longer maintain two template libraries. When the insurance carrier requires a new clause for ATV, the system updates everywhere it should — automatically. Operators stop being the front line of legal defensibility.',
    metric:null },
  { Icon:IconLIABLPass, title:'Returning participants take seconds',
    body:'LIABL Pass turns a 12-18 minute first-time waiver into a 15-second tap for returning guests. At 40 repeat customers per week in peak season, that\'s 8-12 hours/week recovered.',
    metric:'8-12 hours/week recovered' },
  { Icon:IconRiskProfile, title:'Risk becomes a signal at check-in',
    body:'Today, operators find out a guest has a heart condition when something goes wrong. With AI risk profiling, the operator sees an elevated score at the moment the participant signs — before they hit the water. That changes how staff brief, how groups get assigned, and how insurance prices risk.',
    metric:null },
  { Icon:IconShield, title:'Insurance conversations get better',
    body:'When an incident occurs, operators hand over verified documents with chain-of-custody, real-time risk scores, and participant identity that traces across sessions. Carriers are starting to ask for this. Operators with it qualify for preferred rates.',
    metric:'8-15% premium reduction' },
]

const PREMIUM_DEFENSE = [
  { num:'01', kicker:'The math', headline:'LIABL pays for itself in the first 30 days.',
    body:'$3,366/yr labor recovered. $1,600-$3,000/yr in insurance savings. Premium plan returns 10-30x its cost in year one.',
    callout1:"Operators don't pay for features.", callout2:'They pay for ROI.' },
  { num:'02', kicker:'The alternative', headline:"The right comparison isn't competitor pricing.",
    body:'A single bad incident with a missing waiver costs $50K-$500K in legal exposure. Paying $300/mo more for a defensible AI-generated waiver isn\'t a premium.',
    callout1:"It's insurance.", callout2:'Priced against the cost of being wrong.' },
  { num:'03', kicker:'The upside', headline:'Operators buy access to a network that compounds.',
    body:'LIABL Pass and the identity graph build over time. Operators paying $349 today buy into a participant intelligence layer that will be worth more in 18 months than it is today.',
    callout1:"Operators aren't buying a tool.", callout2:'They\'re buying a position in the network.' },
]

export default function OperatorValueSubTab() {
  return (
    <div className="space-y-12">

      {/* ── Section 1 — Why operators care ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">In operator language</p>
        <h2 className="font-serif text-2xl text-ink mb-2" style={{ letterSpacing:'-0.015em' }}>Why operators care.</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-2xl leading-relaxed">
          Not architecture. Not intelligence. Time, risk, money, and not being the operator who shows up in a deposition.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARES.map(({ Icon, title, body, metric }) => (
            <div key={title} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
                  <Icon size={16} color="#C2410C"/>
                </div>
                <div className="font-medium text-sm text-ink leading-snug pt-1">{title}</div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-2">{body}</p>
              {metric && (
                <div className="inline-block bg-accent-light text-accent-deep text-[11px] font-medium px-2.5 py-1 rounded-md">
                  {metric}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2 — Why they pay more ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">The pricing defense</p>
        <h2 className="font-serif text-2xl text-ink mb-2" style={{ letterSpacing:'-0.015em' }}>Why they pay more.</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-2xl leading-relaxed">
          Industry standard is $25-50/mo. LIABL Connected is $149. LIABL Intelligence is $349. Here&apos;s why operators choose to pay it.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {PREMIUM_DEFENSE.map(p => (
            <div key={p.num} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="text-[11px] font-semibold tracking-widest uppercase text-brand mb-2">
                {p.num} · {p.kicker}
              </div>
              <div className="font-medium text-base text-ink leading-snug mb-3">{p.headline}</div>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">{p.body}</p>
              <div className="bg-slate-light border border-black/8 rounded-lg p-3">
                <div className="text-[11px] text-gray-500 mb-1">{p.callout1}</div>
                <div className="text-sm font-medium text-ink">{p.callout2}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Closing thesis */}
        <div className="bg-ink rounded-2xl p-6 text-white">
          <p className="text-sm leading-relaxed text-white/90">
            LIABL isn&apos;t priced against the industry standard. It&apos;s priced against the{' '}
            <span className="text-white font-medium">value it returns</span> — and the{' '}
            <span className="text-accent font-medium">exposure it removes</span>. Operators who do the math choose LIABL. Operators who don&apos;t, choose the cheapest option — and find out later what it cost.
          </p>
        </div>
      </div>

    </div>
  )
}
