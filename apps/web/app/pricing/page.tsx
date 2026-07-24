'use client'
import { useState } from 'react'
import Logo from '@/components/Logo'
import PageNav from '@/components/PageNav'
import { IconAnalytics, IconRiskProfile } from '@/components/icons'

type Period = 'monthly' | 'annual'

const TIERS = [
  {
    id:'core',
    name:'Core',
    // v14: reworded tagline — no competitor reference
    tagline:'Everything you need to get started.',
    monthly:49, annual:39,
    sigMonthly:500, sigAnnual:6000,
    highlight:false,
    features:[
      'Up to 500 signatures/month',
      'Unlimited participants',
      'Adaptive document engine',
      'Guardian flow for minors',
      'Operator roster & check-in',
      'Email confirmations',
      '90-day document retention',
      '1 operator user seat',
    ],
    missing:['LIABL Pass','Group reservations','Booking integrations','Analytics','API access'],
    overageBlock:15,   // $ per 500-sig block
    overageUnit:0.04,  // $ per single signature
  },
  {
    id:'connected',
    name:'Connected',
    tagline:'Your booking platform and LIABL — always in sync.',
    monthly:149, annual:119,
    sigMonthly:2500, sigAnnual:30000,
    highlight:true,
    features:[
      'Up to 2,500 signatures/month',
      'Unlimited participants',
      'Everything in Core',
      'LIABL Pass (cross-operator)',
      'Group reservations (all 4 tabs)',
      'FareHarbor, Rezdy, Xola, Bókun',
      'Bidirectional webhooks',
      'Analytics + CSV export',
      'Staff notes & addendum workflow',
      '3-year document retention',
      '5 operator user seats',
      'API read access',
    ],
    missing:['Role-based access control','Legal hold & lifecycle mgmt','SSO (Azure / Okta)'],
    overageBlock:12,
    overageUnit:0.03,
  },
  {
    id:'intelligence',
    name:'Intelligence',
    tagline:'The compliance layer your legal team has been asking for.',
    monthly:349, annual:279,
    sigMonthly:20000, sigAnnual:240000,
    highlight:false,
    features:[
      'Up to 20,000 signatures/month',
      'Unlimited participants',
      'Everything in Connected',
      'Full analytics suite + risk scoring',
      'Document lifecycle management',
      'Legal hold & retention policies',
      'Role-based access control',
      'Metadata tagging',
      'Audit trail & hash verification',
      'GDPR/CCPA deletion workflow',
      '7-year document retention',
      '50 operator user seats',
      'Full API access (read/write)',
      'Priority support',
    ],
    missing:[],
    overageBlock:8,
    overageUnit:0.02,
  },
]

// v14: no "Participants" row per spec
const COMPARE: {feature:string;core:string|boolean;connected:string|boolean;intelligence:string|boolean}[] = [
  {feature:'Signatures — monthly',      core:'500',          connected:'2,500',         intelligence:'20,000'       },
  {feature:'Signatures — annual',       core:'6,000',        connected:'30,000',        intelligence:'240,000'      },
  {feature:'Overage (block of 500)',    core:'$15/block',    connected:'$12/block',     intelligence:'$8/block'     },
  {feature:'Overage (per signature)',   core:'$0.04',        connected:'$0.03',         intelligence:'$0.02'        },
  {feature:'User seats',                core:'1',            connected:'5',             intelligence:'50'           },
  {feature:'Document retention',        core:'90 days',      connected:'3 years',       intelligence:'7 years'      },
  {feature:'Adaptive document engine',  core:true,           connected:true,            intelligence:true           },
  {feature:'AI risk scoring',           core:true,           connected:true,            intelligence:true           },
  {feature:'Guardian flow',             core:true,           connected:true,            intelligence:true           },
  {feature:'LIABL Pass',                core:false,          connected:true,            intelligence:true           },
  {feature:'Group reservations',        core:false,          connected:true,            intelligence:true           },
  {feature:'Booking integrations',      core:false,          connected:true,            intelligence:true           },
  {feature:'Analytics & export',        core:false,          connected:true,            intelligence:true           },
  {feature:'Insurance integrations',    core:false,          connected:true,            intelligence:true           },
  {feature:'Webhooks & API',            core:false,          connected:'Read only',     intelligence:'Full'         },
  {feature:'Role-based access control', core:false,          connected:false,           intelligence:true           },
  {feature:'Legal hold',                core:false,          connected:false,           intelligence:true           },
  {feature:'SSO (Azure / Okta)',        core:false,          connected:false,           intelligence:'Add-on'       },
  {feature:'Priority support',          core:false,          connected:false,           intelligence:true           },
]

function Cell({val}:{val:string|boolean}){
  if(val===true)  return <span className="text-emerald-500 font-bold">✓</span>
  if(val===false) return <span className="text-gray-200 font-bold">—</span>
  return <span className="text-xs font-medium text-ink">{val}</span>
}

function fmt(n:number){return n.toLocaleString()}

export default function PricingPage() {
  const [period,       setPeriod]       = useState<Period>('monthly')
  const [showCompare,  setShowCompare]  = useState(false)
  const [showOverage,  setShowOverage]  = useState(false)
  const savings = Math.round((1 - 39/49) * 100)

  return (
    <div className="min-h-screen bg-surface">
      <PageNav badge="Pricing" />

      <div className="max-w-4xl mx-auto px-4 py-14">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Pricing</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink mb-3" style={{letterSpacing:'-0.02em'}}>
            Feature-based pricing. Unlimited participants.
          </h1>
          <p className="text-gray-500 text-base max-w-xl mx-auto leading-relaxed mb-6">
            Plans are based on features and signature volume — not per-waiver fees.
            You never pay more just because you&apos;re busy.
          </p>

          {/* Period toggle */}
          <div className="inline-flex items-center gap-3">
            <div className="flex gap-1 bg-white border border-black/10 rounded-xl p-1">
              {(['monthly','annual'] as Period[]).map(p=>(
                <button key={p} onClick={()=>setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${period===p?'bg-brand text-white shadow-sm':'text-gray-500 hover:text-ink'}`}>
                  {p}
                </button>
              ))}
            </div>
            {period==='annual' && (
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                Save ~{savings}% + higher annual limits
              </span>
            )}
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {TIERS.map(t => {
            const price = period==='annual' ? t.annual : t.monthly
            const sigs  = period==='annual' ? fmt(t.sigAnnual) : fmt(t.sigMonthly)
            const sigLabel = period==='annual' ? '/year' : '/month'
            return (
              <div key={t.id} className={`rounded-2xl border p-6 flex flex-col ${
                t.highlight
                  ? 'border-brand bg-brand text-white shadow-xl shadow-brand/20 scale-[1.02]'
                  : 'border-black/10 bg-white'
              }`}>
                {t.highlight && <div className="text-xs font-semibold tracking-widest uppercase mb-3 text-white/60">Most popular</div>}
                <div className={`text-xs font-semibold tracking-widest uppercase mb-1 ${t.highlight?'text-white/60':'text-brand'}`}>{t.name}</div>
                <div className={`font-serif text-4xl mb-1 ${t.highlight?'text-white':'text-ink'}`} style={{letterSpacing:'-0.02em'}}>
                  ${price}<span className={`text-base font-sans font-normal ${t.highlight?'text-white/60':'text-gray-400'}`}>/mo</span>
                </div>
                {period==='annual' && (
                  <div className={`text-xs mb-1 ${t.highlight?'text-white/60':'text-gray-400'}`}>
                    Billed annually · ${price*12}/yr
                  </div>
                )}
                {/* Signature volume — prominent */}
                <div className={`text-sm font-semibold mb-4 ${t.highlight?'text-white':'text-brand'}`}>
                  {sigs} signatures{sigLabel}
                </div>
                <p className={`text-sm mb-5 leading-relaxed ${t.highlight?'text-white/80':'text-gray-500'}`}>{t.tagline}</p>

                <div className="space-y-2 mb-6 flex-1">
                  {t.features.slice(0,8).map(f=>(
                    <div key={f} className="flex items-start gap-2 text-xs">
                      <span className={`shrink-0 mt-0.5 font-bold ${t.highlight?'text-white':'text-emerald-500'}`}>✓</span>
                      <span className={t.highlight?'text-white/90':'text-gray-600'}>{f}</span>
                    </div>
                  ))}
                  {t.features.length>8 && (
                    <div className={`text-xs mt-1 ${t.highlight?'text-white/40':'text-gray-300'}`}>
                      + {t.features.length-8} more features
                    </div>
                  )}
                </div>

                {/* Overage callout */}
                <div className={`text-xs rounded-lg px-3 py-2 mb-4 ${t.highlight?'bg-white/10 text-white/70':'bg-surface text-gray-500'}`}>
                  Overage: ${t.overageBlock}/500 sigs or ${t.overageUnit}/sig
                </div>

                <button className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  t.highlight?'bg-white text-brand hover:bg-white/90':'bg-brand text-white hover:opacity-90'
                }`}>
                  Start free trial
                </button>
              </div>
            )
          })}
        </div>

        {/* Overage explainer */}
        <div className="mb-6">
          <button onClick={()=>setShowOverage(!showOverage)}
            className="text-sm text-brand underline hover:opacity-70 transition-opacity">
            {showOverage?'Hide':'How do overages work?'} →
          </button>
        </div>

        {showOverage && (
          <div className="bg-white rounded-2xl border border-black/10 p-6 mb-8 animate-fade-up">
            <h3 className="font-serif text-lg text-ink mb-1" style={{letterSpacing:'-0.01em'}}>Overage options</h3>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              If you exceed your monthly or annual signature limit, you have two options.
              Choose at account setup — you can change this at any time.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-surface rounded-xl border border-black/10 p-4">
                <div className="font-semibold text-ink mb-1">Option A — Block purchase</div>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">
                  Buy additional signatures in blocks of 500. Blocks are pre-purchased and never expire within your billing year.
                  Best for operators with predictable seasonal spikes.
                </p>
                <div className="space-y-2">
                  {TIERS.map(t=>(
                    <div key={t.id} className="flex justify-between text-xs bg-white rounded-lg border border-black/8 px-3 py-2">
                      <span className="text-gray-500">{t.name}</span>
                      <span className="font-semibold text-ink">${t.overageBlock} per 500 signatures</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-surface rounded-xl border border-black/10 p-4">
                <div className="font-semibold text-ink mb-1">Option B — Pay as you go</div>
                <p className="text-sm text-gray-500 leading-relaxed mb-3">
                  Pay a per-signature rate for every signature beyond your limit. Charged automatically at end of billing period.
                  Best for operators with unpredictable volume.
                </p>
                <div className="space-y-2">
                  {TIERS.map(t=>(
                    <div key={t.id} className="flex justify-between text-xs bg-white rounded-lg border border-black/8 px-3 py-2">
                      <span className="text-gray-500">{t.name}</span>
                      <span className="font-semibold text-ink">${t.overageUnit} per signature</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 text-sm text-brand">
              <span className="inline-flex items-center gap-2"><IconRiskProfile size={16} color="#4B2ACF"/> <strong>Tip:</strong></span> If you consistently exceed your limit, upgrading to the next tier is almost always more cost-effective than overages.
              LIABL will notify you when you reach 80% of your monthly limit.
            </div>
          </div>
        )}

        {/* Compare toggle */}
        <div className="text-center mb-8">
          <button onClick={()=>setShowCompare(!showCompare)}
            className="text-sm text-brand underline hover:opacity-70 transition-opacity">
            {showCompare?'Hide':'Show'} full feature comparison →
          </button>
        </div>

        {showCompare && (
          <div className="bg-white rounded-2xl border border-black/10 overflow-hidden mb-10 animate-fade-up">
            <div className="grid grid-cols-4">
              <div className="px-4 py-3 border-b border-black/8 text-xs font-semibold text-gray-400 uppercase tracking-wider">Feature</div>
              {['Core','Connected','Intelligence'].map((name,i)=>(
                <div key={name} className={`px-4 py-3 border-b border-black/8 text-sm font-semibold text-center ${i===1?'text-brand':'text-ink'}`}>{name}</div>
              ))}
              {COMPARE.map((row,i)=>(
                <>
                  <div key={`${row.feature}-l`} className={`px-4 py-3 text-xs text-gray-600 border-b border-black/5 ${i%2===0?'':'bg-surface/40'}`}>{row.feature}</div>
                  {(['core','connected','intelligence'] as const).map(tier=>(
                    <div key={`${row.feature}-${tier}`} className={`px-4 py-3 text-center border-b border-black/5 ${i%2===0?'':'bg-surface/40'}`}>
                      <Cell val={row[tier]}/>
                    </div>
                  ))}
                </>
              ))}
            </div>
          </div>
        )}

        {/* TCO calculator callout */}
        <div className="bg-white rounded-2xl border border-black/10 p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center"><IconAnalytics size={22} color="#4B2ACF"/></div>
            <div className="flex-1">
              <h3 className="font-semibold text-ink mb-1">What does your current solution actually cost?</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Most operators underestimate the true cost of manual or generic waiver workflows.
                Staff time, legal exposure, and lost session capacity add up fast.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  {label:'Staff time at check-in',  calc:'15 min × 3 sessions/day × 250 days',     result:'187 staff-hours/year'},
                  {label:'At $18/hr loaded cost',   calc:'187 hours × $18',                          result:'$3,366/year'},
                  {label:'vs. LIABL Connected',     calc:'$149/mo × 12',                             result:'$1,788/year'},
                ].map(({label,calc,result})=>(
                  <div key={label} className="bg-surface rounded-xl p-3 text-xs">
                    <div className="font-semibold text-ink mb-1">{label}</div>
                    <div className="text-gray-400 mb-1">{calc}</div>
                    <div className="font-semibold text-brand">{result}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                This calculation excludes legal exposure from unverifiable waivers and manual guardian paperwork.
                The average recreational liability settlement is $4.2M — a defensible waiver is not optional.
              </p>
            </div>
          </div>
        </div>

        {/* Enterprise & White-label */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-ink rounded-2xl p-6 text-white">
            <div className="text-xs font-semibold tracking-widest uppercase mb-3" style={{color:'#A78BFA'}}>Enterprise</div>
            <h3 className="font-serif text-xl mb-2" style={{letterSpacing:'-0.01em'}}>Multi-location &amp; compliance-first</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">Custom signature volume, SSO, SCIM, dedicated support, and multi-location reporting.</p>
            <div className="space-y-1.5 mb-5">
              {['Custom signature volume','SSO + SCIM provisioning','Dedicated support & SLA','Multi-location reporting','Volume pricing'].map(f=>(
                <div key={f} className="flex items-center gap-2 text-xs text-gray-300"><span className="text-violet-400">✓</span>{f}</div>
              ))}
            </div>
            <button className="w-full py-3 rounded-xl font-semibold text-sm bg-white text-ink hover:bg-white/90 transition-all">Contact sales →</button>
          </div>
          <div className="bg-brand/5 border border-brand/20 rounded-2xl p-6">
            <div className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">White-Label</div>
            <h3 className="font-serif text-xl text-ink mb-2" style={{letterSpacing:'-0.01em'}}>Booking platforms &amp; franchises</h3>
            <p className="text-gray-500 text-sm leading-relaxed mb-4">Embed LIABL under your own brand. Platform fee pricing, revenue share model, and dedicated integration engineering.</p>
            <div className="space-y-1.5 mb-5">
              {['Full UI white-labeling','Custom domain & branding','15–20% revenue share on referred operators','Eliminates $400K–800K in-house build cost','Dedicated integration engineering'].map(f=>(
                <div key={f} className="flex items-center gap-2 text-xs text-gray-600"><span className="text-brand">✓</span>{f}</div>
              ))}
            </div>
            <button className="w-full py-3 rounded-xl font-semibold text-sm bg-brand text-white hover:opacity-90 transition-all">Explore partnership →</button>
          </div>
        </div>

      </div>
    </div>
  )
}
