'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'

// ── Inline AdaptiveDemo for hero (lightweight version) ────────
type HeroActivity = 'kayak'|'hike'|'atv'|'climb'|null
type HeroHealth   = 'none'|'cardiac'|'injury'|null

interface HeroClause { label:string; body:string; adaptive:boolean }

function buildHeroClauses(a: HeroActivity, h: HeroHealth): HeroClause[] {
  if (!a) return []
  const act = { kayak:'Whitewater Kayaking', hike:'Canyon Hiking', atv:'ATV Tour', climb:'Rock Climbing' }[a]
  const base: HeroClause[] = [
    { label:'Assumption of Risk',    adaptive:false, body:`Participant acknowledges the inherent risks of ${act} and voluntarily assumes full responsibility for any injuries or damages.` },
    { label:'Release of Liability',  adaptive:false, body:`Participant releases the operator from all liability arising from participation in ${act}, including acts of negligence.` },
    { label:'Equipment & Safety',    adaptive:false, body:'Participant confirms receipt of a full safety briefing and proper fitting of all required safety equipment.' },
    { label:{ kayak:'Water Hazards', hike:'Terrain & Flash Flood', atv:'Motor Vehicle Operation', climb:'Fall & Equipment Hazards' }[a], adaptive:false,
      body:{ kayak:'Participant acknowledges Class III–IV rapids, submerged obstacles, and risk of capsize.', hike:'Participant acknowledges uneven terrain, extreme temperatures, and flash flood risk.', atv:'Participant confirms compliance with all speed limits and will not operate under any substance.', climb:'Participant confirms understanding of all anchor systems and harness equipment.' }[a] },
  ]
  if (h === 'cardiac') base.push({ label:'⚡ Physician Clearance — Cardiovascular', adaptive:true, body:'Participant has disclosed a cardiovascular condition. Confirms written physician clearance within 30 days. Participation without valid clearance voids this waiver.' })
  if (h === 'injury')  base.push({ label:'⚡ Recent Injury Disclosure',              adaptive:true, body:'Participant has disclosed a recent injury or surgery. Confirms physician clearance for physical activity of this intensity.' })
  return base
}

const ACTS: { key:HeroActivity; Icon:React.ComponentType<{size?:number;color?:string}>; label:string }[] = [
  { key:'kayak', Icon:IconKayak, label:'Kayaking'  },
  { key:'hike',  Icon:IconHike,  label:'Hiking'    },
  { key:'atv',   Icon:IconATV,   label:'ATV Tour'  },
  { key:'climb', Icon:IconClimb, label:'Climbing'  },
]

// ── Network effect calculator ─────────────────────────────────
function calcRecognition(ops: number): number {
  if (ops < 10)   return Math.round(ops * 0.8)
  if (ops < 100)  return Math.round(8 + (ops - 10) * 0.35)
  if (ops < 1000) return Math.round(39 + (ops - 100) * 0.022)
  if (ops < 5000) return Math.round(59 + (ops - 1000) * 0.00225)
  return Math.min(68 + Math.round((ops - 5000) * 0.0005), 89)
}

// ── Tile data — transformed labels ───────────────────────────
import { IconSigned, IconLIABLPass, IconRiskProfile, IconAuditTrail, IconIntegration, IconLegalHold, IconDocumentIntelligence, IconNetwork, IconUser, IconShield, IconTrending, IconKayak, IconHike, IconATV, IconClimb, IconAnalytics, IconAIActive } from '@/components/icons'

const TILES = [
  { href:'/participant', label:'Participants',  sub:'Adaptive documents, built from each answer.',  bg:'#4B2ACF', Icon:IconSigned             },
  { href:'/portal',      label:'LIABL Pass',    sub:'Cross-operator identity. 15-second re-sign.',  bg:'#0891B2', Icon:IconLIABLPass          },
  { href:'/operator',    label:'Operators',     sub:'Roster, risk intelligence, incident response.',bg:'#059669', Icon:IconRiskProfile        },
  { href:'/groups',      label:'Groups',        sub:'Pre-arrival signing for tours and teams.',     bg:'#7C3AED', Icon:IconDocumentIntelligence },
  { href:'/integrations','label':'Integrations',sub:'FareHarbor, Rezdy, SSO, insurance.',           bg:'#D97706', Icon:IconIntegration        },
  { href:'/security',    label:'Security',      sub:'Sealed, audited, legally defensible.',         bg:'#DC2626', Icon:IconLegalHold          },
  { href:'/pricing',     label:'Pricing',       sub:'Feature-based tiers from $49/mo.',             bg:'#0D9488', Icon:IconAuditTrail         },
  { href:'/why',         label:'Why LIABL',     sub:'The market case and network thesis.',          bg:'#BE185D', Icon:IconNetwork            },
]

export default function Home() {
  const [heroActivity, setHeroActivity] = useState<HeroActivity>(null)
  const [heroHealth,   setHeroHealth]   = useState<HeroHealth>(null)
  const [operators,    setOperators]    = useState(500)
  const [activeSegment,setActiveSegment]= useState<'operator'|'enterprise'|'platform'|null>(null)
  const segmentRef = useRef<HTMLDivElement>(null)

  const heroClauses    = buildHeroClauses(heroActivity, heroHealth)
  const adaptiveCount  = heroClauses.filter(c => c.adaptive).length
  const recognition    = calcRecognition(operators)

  function scrollToSegment() {
    segmentRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })
  }

  // Auto-cycle activity in hero to show the demo working
  useEffect(() => {
    const acts: HeroActivity[] = ['kayak','hike','atv','climb']
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % acts.length
      setHeroActivity(acts[i])
      setHeroHealth(null)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="min-h-screen bg-surface">

      {/* ── Nav ── */}
      <nav className="bg-white border-b border-black/10 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <Logo size="md" />
        <div className="flex items-center gap-3">
          <Link href="/why" className="text-sm text-gray-500 hover:text-ink transition-colors hidden sm:block">Investors</Link>
          <Link href="/pricing" className="text-sm text-gray-500 hover:text-ink transition-colors hidden sm:block">Pricing</Link>
          <Link href="/brand" className="text-sm text-gray-500 hover:text-ink transition-colors hidden sm:block">Brand</Link>
          <Link href="/start" className="text-sm px-4 py-2 bg-brand text-white rounded-xl font-medium hover:opacity-90 transition-all">
            Start free trial →
          </Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — HERO
      ══════════════════════════════════════════════════════ */}
      <section className="px-6 pt-20 pb-10 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left — headline */}
            <div>
              <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-brand/20">
                <span>⚡</span> AI-native document intelligence
              </div>
              <h1 className="font-serif text-4xl sm:text-5xl text-ink leading-tight mb-5" style={{ letterSpacing:'-0.025em' }}>
                Your documents shouldn&apos;t be forms.{' '}
                <span className="text-brand">They should adapt.</span>
              </h1>
              <p className="text-gray-500 text-lg leading-relaxed mb-4">
                LIABL builds the document from each participant&apos;s answers in real time —
                adaptive, activity-specific, and legally defensible from the first signature.
              </p>
              <p className="text-sm text-gray-400 mb-8">
                Starting with liability waivers — built for every document the activity industry runs on.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/participant"
                  className="px-6 py-3 bg-brand text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all">
                  See it work →
                </Link>
                <button onClick={scrollToSegment}
                  className="px-6 py-3 bg-surface border border-black/15 text-ink rounded-xl font-semibold text-sm hover:bg-white transition-all">
                  Find your use case
                </button>
              </div>

              {/* Live stats */}
              <div className="flex gap-6 mt-8 pt-8 border-t border-black/8">
                {[
                  { value:'< 2 min',  label:'First-time signing'    },
                  { value:'~15 sec',  label:'Returning via LIABL Pass' },
                  { value:'68%',      label:'Recognition at 5K operators' },
                ].map(({ value, label }) => (
                  <div key={label}>
                    <div className="font-serif text-xl font-semibold text-brand" style={{ letterSpacing:'-0.02em' }}>{value}</div>
                    <div className="text-xs text-gray-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — live adaptive demo */}
            <div className="bg-surface rounded-2xl border border-black/10 overflow-hidden">
              {/* New demo bar: indigo gradient, brand sparkle, GENERATING verb, indigo chip, flowing accent */}
              <div className="relative px-5 py-3 flex items-center justify-between overflow-hidden"
                style={{ background: 'linear-gradient(to right, #1a1130, #0D0E12)' }}>
                {/* Left content — sparkle + two-line label */}
                <div className="flex items-center gap-3">
                  <IconAIActive size={22} color="#A78BFA"/>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-white/70" style={{ letterSpacing:'0.12em' }}>
                        GENERATING
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"/>
                    </div>
                    <span className="text-white text-xs font-semibold leading-tight">
                      LIABL Document Intelligence
                    </span>
                  </div>
                </div>
                {/* Right chip — adaptive count, indigo brand-mid */}
                {adaptiveCount > 0 && (
                  <span className="text-xs text-white px-2.5 py-1 rounded-full font-medium shrink-0"
                    style={{ background:'#6344E0' }}>
                    {adaptiveCount} adaptive clause{adaptiveCount > 1 ? 's' : ''} added
                  </span>
                )}
                {/* Animated accent stroke at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
                  <div className="h-full w-1/3 rounded-full"
                    style={{
                      background:'linear-gradient(to right, transparent, #EA580C, transparent)',
                      animation:'flow 3.5s ease-in-out infinite',
                    }}/>
                </div>
              </div>

              {/* Activity selector */}
              <div className="px-5 pt-4 pb-3 border-b border-black/8">
                <div className="text-xs text-gray-400 mb-2">Select activity — watch the document respond</div>
                <div className="flex gap-2 flex-wrap">
                  {ACTS.map(a => (
                    <button key={a.key} onClick={() => { setHeroActivity(a.key); setHeroHealth(null) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        heroActivity === a.key
                          ? 'bg-brand text-white border-brand'
                          : 'bg-white text-gray-600 border-black/15 hover:border-brand/40'
                      }`}>
                      <a.Icon size={14} color={heroActivity === a.key ? '#FFFFFF' : '#6B7280'}/>
                      {a.label}
                    </button>
                  ))}
                </div>

                {heroActivity && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-1.5">Health disclosure — notice what changes</div>
                    <div className="flex gap-2">
                      {([['none','No conditions'],['cardiac','Cardiac condition'],['injury','Recent injury']] as [HeroHealth,string][]).map(([v,l]) => (
                        <button key={v} onClick={() => setHeroHealth(v)}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                            heroHealth === v ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-500 border-black/15 hover:border-amber-300'
                          }`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Live document */}
              <div className="px-5 py-4 max-h-72 overflow-y-auto space-y-2">
                {heroClauses.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <div className="mb-2 animate-pulse-soft flex justify-center"><IconDocumentIntelligence size={32} color="#9CA3AF"/></div>
                    <div className="text-sm">Select an activity above</div>
                    <div className="text-xs mt-1">The document builds itself from participant answers</div>
                  </div>
                ) : (
                  heroClauses.map((c, i) => (
                    <div key={i} className={`rounded-xl p-3 text-xs transition-all duration-300 animate-fade-up ${
                      c.adaptive ? 'bg-brand/5 border border-brand/20' : 'bg-white border border-black/8'
                    }`} style={{ animationDelay:`${i * 50}ms` }}>
                      <div className={`font-semibold uppercase tracking-wider text-xs mb-1 ${c.adaptive ? 'text-brand' : 'text-gray-400'}`}>
                        {c.label}
                      </div>
                      <p className="text-gray-500 leading-relaxed">{c.body}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="px-5 py-3 border-t border-black/8 bg-surface/50 text-xs text-gray-400 flex items-center justify-between">
                <span>AI-generated in real time · ESIGN Act compliant</span>
                {heroClauses.length > 0 && (
                  <span className="font-medium text-ink">{heroClauses.length} clauses · {adaptiveCount} adaptive</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — CATEGORY CONTRAST
      ══════════════════════════════════════════════════════ */}
      <section className="px-6 py-16 bg-ink text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color:'#A78BFA' }}>
              A different architecture
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl mb-3" style={{ letterSpacing:'-0.02em' }}>
              Traditional documents are static. Ours aren&apos;t.
            </h2>
            <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">
              The activity industry has been running on form-first thinking for 20 years.
              LIABL was built on a different premise entirely.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Legacy column */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-xs font-semibold tracking-widest uppercase mb-4 text-gray-500">
                Traditional approach
              </div>
              <div className="space-y-3">
                {[
                  { Icon:IconSigned,             text:'Operator writes a template once. Every participant gets the same document.' },
                  { Icon:IconAuditTrail,         text:'Completed form stored in a folder. No intelligence. No identity. No network.' },
                  { Icon:IconRiskProfile,        text:'When something goes wrong, someone searches manually through files.' },
                  { Icon:IconDocumentIntelligence,text:'Every new participant starts from scratch, regardless of history with your business.' },
                  { Icon:IconAnalytics,          text:'No risk signals until after the incident. No data that improves over time.' },
                ].map(({ Icon, text }) => (
                  <div key={text} className="flex items-start gap-3 text-sm text-gray-400">
                    <span className="shrink-0 opacity-50 mt-0.5"><Icon size={18} color="#9CA3AF"/></span>
                    <span className="leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* LIABL column */}
            <div className="bg-brand/15 border border-brand/30 rounded-2xl p-6">
              <div className="text-xs font-semibold tracking-widest uppercase mb-4 text-brand">
                LIABL — AI-native
              </div>
              <div className="space-y-3">
                {[
                  { kind:'glyph' as const, char:'⚡',      text:'Document builds itself from participant answers. A cardiac condition changes the waiver — not just adds a note.' },
                  { kind:'icon'  as const, Icon:IconRiskProfile, text:'Every signature is a data event. Every answer is a risk signal. The platform gets smarter with every signing.' },
                  { kind:'icon'  as const, Icon:IconLegalHold,   text:'SHA-256 sealed at signing time. Full chain of custody produced in seconds. Forensically complete.' },
                  { kind:'glyph' as const, char:'✦',      text:'Returning participants recognized across every LIABL operator. 15-second re-sign. Identity that compounds.' },
                  { kind:'icon'  as const, Icon:IconNetwork,     text:'Real-time risk intelligence at check-in. Shared with your insurer automatically. Defensible before the session starts.' },
                ].map((row) => (
                  <div key={row.text} className="flex items-start gap-3 text-sm text-white">
                    <span className="shrink-0 mt-0.5">
                      {row.kind === 'glyph'
                        ? <span className="text-lg leading-none">{row.char}</span>
                        : <row.Icon size={18} color="#FFFFFF"/>}
                    </span>
                    <span className="leading-relaxed">{row.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — EXPLORE THE PLATFORM (transformed tiles) — moved up in v21
      ══════════════════════════════════════════════════════ */}
      <section className="px-6 py-16 bg-surface border-b border-black/8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">The Platform</p>
            <h2 className="font-serif text-3xl text-ink mb-3" style={{ letterSpacing:'-0.02em' }}>
              Explore the intelligence platform.
            </h2>
            <p className="text-gray-500 text-base max-w-lg mx-auto">
              Every module is built on the same AI-native foundation. Each one generates intelligence the others use.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TILES.map(({ href, label, sub, bg, Icon }) => (
              <Link key={href} href={href}
                className="bg-white rounded-2xl border border-black/10 hover:border-black/20 hover:shadow-md transition-all p-5 group text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform mx-auto"
                  style={{ background: bg }}>
                  <Icon size={20} color="#FFFFFF" />
                </div>
                <div className="font-semibold text-ink text-sm mb-0.5 leading-tight">{label}</div>
                <div className="text-xs text-gray-400 leading-snug">{sub}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — SEGMENT SELECTOR
      ══════════════════════════════════════════════════════ */}
      <section ref={segmentRef} className="px-6 py-16 bg-white border-b border-black/8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Who It&apos;s For</p>
            <h2 className="font-serif text-3xl text-ink mb-3" style={{ letterSpacing:'-0.02em' }}>
              Built for everyone in the activity industry.
            </h2>
            <p className="text-gray-500 text-base max-w-lg mx-auto">
              Different scale, different challenges, same intelligence platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              {
                key:'operator' as const,
                Icon:IconUser,
                headline:'Stop losing 20 minutes per group to check-in.',
                sub:'Adaptive documents, booking platform sync, and a returning participant experience that takes 15 seconds. LIABL gives you that time back on day one.',
                cta:'See how operators use LIABL',
                color:'#4B2ACF',
                iconBg:'#4B2ACF',
                bg:'bg-brand/5 border-brand/20',
              },
              {
                key:'enterprise' as const,
                Icon:IconShield,
                headline:'One incident shouldn\'t expose your entire operation.',
                sub:'Consistent documentation across every location, AI risk intelligence, legal hold automation, and a chain of custody your legal team can produce in seconds.',
                cta:'See how enterprise teams use LIABL',
                color:'#DC2626',
                iconBg:'#DC2626',
                bg:'bg-red-50 border-red-200',
              },
              {
                key:'platform' as const,
                Icon:IconIntegration,
                headline:'Your operators keep asking for document features. We built them.',
                sub:'White-label LIABL under your brand in days, not months. Revenue share on every operator you refer. One integration, every operator covered.',
                cta:'See the partnership model',
                color:'#059669',
                iconBg:'#059669',
                bg:'bg-emerald-50 border-emerald-200',
              },
            ].map(s => (
              <button key={s.key} onClick={() => setActiveSegment(activeSegment === s.key ? null : s.key)}
                className={`text-center p-6 rounded-2xl border transition-all ${
                  activeSegment === s.key ? s.bg + ' shadow-md' : 'bg-surface border-black/10 hover:border-black/20 hover:shadow-sm'
                }`}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto" style={{ background: s.iconBg }}>
                  <s.Icon size={24} color="#FFFFFF"/>
                </div>
                <h3 className="font-serif text-lg text-ink mb-2 leading-tight" style={{ letterSpacing:'-0.01em' }}>
                  {s.headline}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{s.sub}</p>
                <span className="text-xs font-semibold" style={{ color: s.color }}>{s.cta} →</span>
              </button>
            ))}
          </div>

          {/* Expanded segment detail */}
          {activeSegment === 'operator' && (
            <div className="bg-brand/5 border border-brand/20 rounded-2xl p-6 animate-fade-up">
              <h3 className="font-serif text-xl text-ink mb-5" style={{ letterSpacing:'-0.01em' }}>For activity operators</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {[
                  { pain:'Every participant fills out the same form.', solution:'LIABL reads their answers and builds the right document. A cardiac condition doesn\'t add a note — it changes the waiver.' },
                  { pain:'I can\'t tell who\'s signed until they show up.', solution:'Your roster updates the moment they sign. Returning participants take 15 seconds via LIABL Pass — identity already on file.' },
                  { pain:'When something goes wrong, I can\'t find the record.', solution:'Every waiver is cryptographically sealed with a full audit trail. Produced in under 2 minutes. Your insurer is notified automatically.' },
                ].map(({ pain, solution }) => (
                  <div key={pain} className="bg-white rounded-xl border border-black/10 p-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">The problem</div>
                    <p className="text-sm text-gray-600 italic mb-3">&ldquo;{pain}&rdquo;</p>
                    <div className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">LIABL</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{solution}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Link href="/participant" className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all">Try the signing flow →</Link>
                <Link href="/operator"   className="px-5 py-2.5 border border-brand/30 text-brand rounded-xl text-sm font-semibold hover:bg-brand/5 transition-all">See the dashboard →</Link>
              </div>
            </div>
          )}

          {activeSegment === 'enterprise' && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 animate-fade-up">
              <h3 className="font-serif text-xl text-ink mb-5" style={{ letterSpacing:'-0.01em' }}>For enterprise & multi-location operators</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {[
                  { pain:'No consistency across locations.', solution:'Standardized AI-native waivers across every location. One template system, one risk scoring model, one audit standard.' },
                  { pain:'IT requires SSO. Legal requires audit trails.', solution:'Azure AD, Okta, SCIM provisioning. SHA-256 sealed documents. Legal hold automation. Everything IT and legal require, built in.' },
                  { pain:'Insurance renewal is a manual nightmare.', solution:'LIABL generates the underwriting export automatically. Anonymized risk data flows to your carrier. Qualify for preferred rates.' },
                ].map(({ pain, solution }) => (
                  <div key={pain} className="bg-white rounded-xl border border-black/10 p-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">The problem</div>
                    <p className="text-sm text-gray-600 italic mb-3">&ldquo;{pain}&rdquo;</p>
                    <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">LIABL</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{solution}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Link href="/security"    className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all">See security & compliance →</Link>
                <Link href="/operator"    className="px-5 py-2.5 border border-red-300 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-all">Multi-location dashboard →</Link>
              </div>
            </div>
          )}

          {activeSegment === 'platform' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 animate-fade-up">
              <h3 className="font-serif text-xl text-ink mb-5" style={{ letterSpacing:'-0.01em' }}>For booking platforms & integration partners</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {[
                  { pain:'Building it in-house costs $400K–$800K.', solution:'White-label LIABL in days. Full UI under your brand, your domain, your API. Zero engineering overhead beyond a single integration.' },
                  { pain:'Operators who use embedded tools churn less.', solution:'34% lower operator churn when waiver workflow is embedded in your platform. The integration creates switching cost that works in your favor.' },
                  { pain:'How do we monetize this?', solution:'15–20% revenue share on every operator subscription referred through your platform. 500 operators at Connected tier = ~$150K/yr passive revenue.' },
                ].map(({ pain, solution }) => (
                  <div key={pain} className="bg-white rounded-xl border border-black/10 p-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">The question</div>
                    <p className="text-sm text-gray-600 italic mb-3">&ldquo;{pain}&rdquo;</p>
                    <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">LIABL</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{solution}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Link href="/integrations" className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all">See white-label preview →</Link>
                <Link href="/pricing"      className="px-5 py-2.5 border border-emerald-300 text-emerald-700 rounded-xl text-sm font-semibold hover:bg-emerald-50 transition-all">Partnership model →</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — THREE THINGS ONLY AI-NATIVE CAN DO
      ══════════════════════════════════════════════════════ */}
      <section className="px-6 py-16 bg-surface border-b border-black/8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">The Intelligence Layer</p>
            <h2 className="font-serif text-3xl text-ink mb-3" style={{ letterSpacing:'-0.02em' }}>
              Three things only an AI-native platform can do.
            </h2>
            <p className="text-gray-500 text-base max-w-lg mx-auto">
              These aren&apos;t features added to a form tool. They require a fundamentally different architecture.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              {
                num:'01',
                Icon:IconDocumentIntelligence,
                title:'Adaptive Documents',
                sub:'The document writes itself',
                desc:'Traditional tools: operator writes a template once. Every participant gets the same document regardless of who they are or what they disclosed. LIABL: the document is generated from the participant\'s answers in real time. A novice kayaker and an experienced one don\'t sign the same waiver. A cardiac condition triggers different legal language — not a checkbox.',
                color:'text-brand',
                iconColor:'#4B2ACF',
                bg:'bg-brand/5 border-brand/20',
              },
              {
                num:'02',
                Icon:IconRiskProfile,
                title:'Intelligent Risk Profiling',
                sub:'Every answer is a signal',
                desc:'Traditional tools: a completed form in a folder. No intelligence extracted. No risk signal computed. LIABL: every answer — activity, age, health, experience — feeds an AI risk profile computed in real time. Visible to the operator at check-in. Shared with the insurer automatically. The operator knows before the session starts.',
                color:'text-amber-600',
                iconColor:'#D97706',
                bg:'bg-amber-50 border-amber-200',
              },
              {
                num:'03',
                Icon:IconNetwork,
                title:'The Participant Identity Graph',
                sub:'Recognition that compounds',
                desc:'Traditional tools: every operator starts from scratch with every participant. No shared intelligence. No network value. LIABL: every signing event builds a verified cross-operator identity. At 5,000 operators, 68% of participants arrive already recognized. That recognition rate is a network effect — and it only compounds. A legacy tool cannot build this. Only an AI-native platform accumulates this kind of intelligence.',
                color:'text-emerald-600',
                iconColor:'#059669',
                bg:'bg-emerald-50 border-emerald-200',
              },
            ].map(item => (
              <div key={item.num} className={`rounded-2xl border p-6 text-center ${item.bg}`}>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="font-serif text-4xl font-bold opacity-20">{item.num}</span>
                  <item.Icon size={28} color={item.iconColor}/>
                </div>
                <h3 className="font-serif text-xl text-ink mb-1" style={{ letterSpacing:'-0.01em' }}>{item.title}</h3>
                <div className={`text-xs font-semibold uppercase tracking-wider mb-3 ${item.color}`}>{item.sub}</div>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Network effect simulator — item D: moved to homepage */}
          <div className="bg-ink rounded-2xl p-6">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
              <div>
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color:'#A78BFA' }}>Live Simulator · The Identity Graph</span>
                <h3 className="font-serif text-2xl text-white mt-1" style={{ letterSpacing:'-0.01em' }}>
                  Every new operator makes every other operator smarter.
                </h3>
              </div>
              <div className={`text-5xl font-serif font-bold text-white`} style={{ letterSpacing:'-0.03em' }}>
                {recognition}<span className="text-2xl text-white/50">%</span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xl">
              Drag the slider. At {operators.toLocaleString()} operators, {recognition}% of participants
              arrive already recognized — profile verified, identity confirmed, ready to sign in 15 seconds.
              This is the moat. It cannot be purchased. It can only be built over time.
            </p>
            <div className="mb-2 flex justify-between text-xs text-white/60">
              <span>Operators on LIABL</span>
              <span className="font-mono text-white font-medium">{operators.toLocaleString()}</span>
            </div>
            <input type="range" min={1} max={10000} step={50} value={operators}
              onChange={e => setOperators(Number(e.target.value))}
              className="w-full cursor-pointer mb-6" style={{ accentColor:'#A78BFA' }}/>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:'Day-one recognition', value:`${recognition}%`, sub:'for new operators joining now' },
                { label:'Returning sign time',  value: recognition > 40 ? '~15 sec' : '~90 sec', sub:'with LIABL Pass' },
                { label:'Network defensibility',value: operators >= 5000 ? 'Defensible moat' : operators >= 1000 ? 'Compounding' : 'Early stage', sub:'identity graph status' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="font-semibold text-white mb-0.5">{value}</div>
                  <div className="text-xs text-white/60 leading-snug">{label}</div>
                  <div className="text-xs text-white/40 leading-snug">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 5 — BUSINESS CASE (STATIC ROI)
      ══════════════════════════════════════════════════════ */}
      <section className="px-6 py-16 bg-white border-b border-black/8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">The Business Case</p>
            <h2 className="font-serif text-3xl text-ink mb-3" style={{ letterSpacing:'-0.02em' }}>
              LIABL pays for itself. Here&apos;s the math.
            </h2>
            <p className="text-gray-500 text-base max-w-lg mx-auto">
              Most operators recover the full cost of LIABL in their first 30 days.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              {
                Icon:IconTrending,
                title:'Time recovered',
                lines:[
                  '15 min saved × 3 sessions/day',
                  '250 operating days per year',
                  '187 staff-hours recovered/year',
                  'At $18/hr loaded cost = $3,366/yr',
                ],
                result:'vs. Connected plan: $1,788/yr',
                net:'Net benefit: +$1,578/yr on labor alone',
                color:'text-brand',
                iconColor:'#4B2ACF',
                bg:'bg-brand/5 border-brand/20',
              },
              {
                Icon:IconShield,
                title:'Insurance savings',
                lines:[
                  'LIABL operators qualify for 8–15%',
                  'premium reductions at renewal',
                  'On a $20,000 annual premium:',
                  '$1,600–$3,000 saved per year',
                ],
                result:'Average: covers the Intelligence plan entirely',
                net:'Net benefit: $0 net cost at scale',
                color:'text-emerald-600',
                iconColor:'#059669',
                bg:'bg-emerald-50 border-emerald-200',
              },
              {
                Icon:IconLegalHold,
                title:'Legal exposure reduced',
                lines:[
                  'Avg recreational liability settlement: $4.2M',
                  'LIABL waivers: AI-generated,',
                  'activity-specific, cryptographically sealed',
                  'Chain of custody in under 2 minutes',
                ],
                result:'Produced in active litigation',
                net:'A defensible waiver is not optional',
                color:'text-red-600',
                iconColor:'#DC2626',
                bg:'bg-red-50 border-red-200',
              },
            ].map(({ Icon, title, lines, result, net, color, iconColor, bg }) => (
              <div key={title} className={`rounded-2xl border p-5 text-center ${bg}`}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 mx-auto" style={{ background: 'white', border: `1px solid ${iconColor}30` }}>
                  <Icon size={24} color={iconColor}/>
                </div>
                <h3 className="font-semibold text-ink mb-3">{title}</h3>
                <div className="space-y-1 mb-4">
                  {lines.map(l => (
                    <div key={l} className="text-xs text-gray-500">{l}</div>
                  ))}
                </div>
                <div className="text-xs font-semibold text-ink mb-1">{result}</div>
                <div className={`text-xs font-bold ${color}`}>{net}</div>
              </div>
            ))}
          </div>

          <div className="bg-ink rounded-2xl p-5 text-center">
            <p className="text-white text-sm leading-relaxed mb-4 max-w-2xl mx-auto">
              The average operator on LIABL Connected recovers the annual subscription cost within the first month
              from staff time alone — before insurance savings or legal exposure reduction are factored in.
            </p>
            <Link href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-ink rounded-xl text-sm font-semibold hover:bg-white/90 transition-all">
              See pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 7 — SOCIAL PROOF
      ══════════════════════════════════════════════════════ */}
      <section className="px-6 py-16 bg-white border-b border-black/8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">What Operators Say</p>
            <h2 className="font-serif text-2xl text-ink" style={{ letterSpacing:'-0.01em' }}>Real results. Real operators.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { quote:'Our morning check-in used to feel like controlled chaos. Now it runs itself. The FareHarbor sync alone saved us an hour a day.', name:'Marcus T.', role:'Owner, Sonoran ATV Adventures', type:'Adventure operator · Arizona', before:'18 min', after:'4 min', metric:'Group check-in time', avatar:'MT', color:'#4B2ACF' },
              { quote:'When we had an incident last spring, I had the full document chain of custody in front of our attorney in under two minutes. That waiver held up.', name:'Rachel K.', role:'Operations Director, Summit Climbing Co.', type:'Climbing gym · Colorado', before:'Paper forms', after:'Digital + verified', metric:'Incident documentation', avatar:'RK', color:'#DC2626' },
              { quote:'We run youth programs — the guardian signature flow is the feature that sold us. Parents sign from home before drop-off. Zero paper at the door.', name:'David L.', role:'Program Manager, Desert Youth Adventures', type:'Youth programs · Nevada', before:'Paper guardian forms', after:'Digital pre-arrival', metric:'Minor authorization', avatar:'DL', color:'#059669' },
            ].map(({ quote, name, role, type, before, after, metric, avatar, color }) => (
              <div key={name} className="bg-surface rounded-2xl border border-black/10 p-5 flex flex-col">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 leading-relaxed italic mb-4">&ldquo;{quote}&rdquo;</p>
                </div>
                <div className="bg-white rounded-xl p-3 mb-4 text-xs border border-black/8">
                  <div className="text-gray-400 mb-1">{metric}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 line-through">{before}</span>
                    <span className="text-gray-300">→</span>
                    <span className="font-semibold text-emerald-600">{after}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: color }}>{avatar}</div>
                  <div>
                    <div className="text-sm font-semibold text-ink">{name}</div>
                    <div className="text-xs text-gray-400">{role}</div>
                    <div className="text-xs text-gray-400">{type}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 8 — DUAL CTA FOOTER
      ══════════════════════════════════════════════════════ */}
      <section className="px-6 py-16 bg-ink text-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color:'#A78BFA' }}>For Operators</p>
              <h3 className="font-serif text-2xl mb-3" style={{ letterSpacing:'-0.01em' }}>
                Start your free trial. Up and running in 15 minutes.
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                No credit card required. Configure your first activity template, send your first invite,
                and see a signed waiver appear in your dashboard — all in under 15 minutes.
              </p>
              <Link href="/operator"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-ink rounded-xl font-semibold text-sm hover:bg-white/90 transition-all">
                Start free trial →
              </Link>
            </div>
            <div className="sm:border-l sm:border-white/10 sm:pl-8">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color:'#A78BFA' }}>For Investors & Partners</p>
              <h3 className="font-serif text-2xl mb-3" style={{ letterSpacing:'-0.01em' }}>
                Building in this space? Let&apos;s talk.
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                LIABL is the AI-native entrant in a category that hasn&apos;t been disrupted in 20 years.
                The market window, the network effect thesis, and the five-year roadmap are all in the investor overview.
              </p>
              <Link href="/why"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/20 text-white rounded-xl font-semibold text-sm hover:bg-white/15 transition-all">
                See investor overview →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 py-6 bg-ink border-t border-white/10 text-center">
        <p className="text-xs text-gray-600">LIABL · AI-native document intelligence · Think faster. Decide better.</p>
      </footer>

    </main>
  )
}
