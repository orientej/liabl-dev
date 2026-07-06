'use client'
import { useState } from 'react'
import Logo         from '@/components/Logo'
import AdaptiveDemo from '@/components/home/AdaptiveDemo'
import NetworkDemo  from '@/components/home/NetworkDemo'
import SalesDemo   from '@/components/home/SalesDemo'
import PageNav from '@/components/PageNav'
import { IconTrending, IconShield, IconIntegration } from '@/components/icons'
import CategoryHistorySubTab from '@/components/why/CategoryHistorySubTab'
import OperatorValueSubTab   from '@/components/why/OperatorValueSubTab'

type Tab = 'why'|'investor'|'demo'
type WhySub = 'history'|'forces'|'value'

const FORCES = [
  { num:'01', iconName:'trending', title:'Activity industry growth', sub:'The market is expanding faster than the tooling', color:'text-brand', bg:'bg-brand/5 border-brand/20', iconColor:'#4B2ACF',
    stats:[{value:'24%',label:'US outdoor recreation growth 2020–2024'},{value:'$887B',label:'US outdoor recreation economy (2024)'},{value:'3.4M',label:'New outdoor participants since 2020'}],
    body:`US outdoor recreation grew 24% between 2020 and 2024. New operators are entering markets that didn't exist five years ago — urban climbing gyms, e-bike tours, cold plunge studios, urban archery ranges.\n\nThese operators are digitally native with no legacy waiver infrastructure. They're greenfield customers who will adopt whatever the default document intelligence solution is for their vertical — and right now, there is no clear default.` },
  { num:'02', iconName:'shield', title:'Rising liability exposure', sub:'Operators know a bad waiver is worse than no waiver', color:'text-amber-600', bg:'bg-amber-50 border-amber-200', iconColor:'#D97706',
    stats:[{value:'+31%',label:'Recreation-related injury suits 2019–2024'},{value:'$4.2M',label:'Average recreation liability settlement'},{value:'67%',label:'Of dismissed suits cite inadequate documentation'}],
    body:`Recreation-related personal injury suits increased 31% between 2019 and 2024. Courts now distinguish between waivers that were signed but not understood and waivers that were read, activity-specific, and clearly accepted.\n\nLIABL's clause read-through tracking, adaptive specificity, and audit trail directly address the documentation standards courts are applying. Insurance carriers are beginning to ask about waiver quality as part of underwriting.` },
  { num:'03', iconName:'integration', title:'Booking platform API maturity', sub:'The integration layer just became capable', color:'text-emerald-600', bg:'bg-emerald-50 border-emerald-200', iconColor:'#059669',
    stats:[{value:'2021–2024',label:'FareHarbor, Rezdy, Xola, Bókun REST API launches'},{value:'4 platforms',label:'With bidirectional webhook support'},{value:'180K+',label:'Operators on FareHarbor alone'}],
    body:`FareHarbor, Rezdy, Xola, and Bókun all launched REST APIs between 2021 and 2024. The technical infrastructure for bidirectional booking-waiver sync didn't exist before this window.\n\nThe 180,000+ operators on FareHarbor represent a distribution channel, not a sales challenge. A single FareHarbor integration surfaces LIABL to every operator at the moment of highest relevance — when a booking is confirmed.` },
]

const COMPETITORS = [
  {name:'DocuSign',    cap:'Enterprise e-sign', gap:'No activity data. No risk calibration. Generic template model.'},
  {name:'Adobe Sign',  cap:'Workflow depth',    gap:'No participant graph. No cross-operator recognition.'},
  {name:'Smartwaiver', cap:'Activity UX',       gap:'Single-tenant. No AI layer. No jurisdiction engine.'},
  {name:'Wherewolf',   cap:'Check-in focus',    gap:'No cross-operator graph. No adaptive document layer.'},
]
const FIVE_FEATURES = [
  {num:'01',phase:'Year 1–2',title:'Adaptive document intelligence',  desc:'Documents build themselves from participant answers — activity, risk, health, jurisdiction. No static templates.'},
  {num:'02',phase:'Year 1–2',title:'LIABL Pass — identity continuity', desc:'Every signing event strengthens a verified cross-operator profile. Returning participants sign in ~15 seconds.'},
  {num:'03',phase:'Year 2–3',title:'Group reservation intelligence',   desc:'Pre-arrival signing, real-time manifest sync, exception management, and booking platform bidirectional webhooks.'},
  {num:'04',phase:'Year 2–3',title:'Operator intelligence layer',      desc:'AI risk scoring, clause read-through rates, insurance integrations, compliance alerts, and analytics.'},
  {num:'05',phase:'Year 3–5',title:'Document network effect',          desc:'At 5,000 operators, 68% of participants arrive already verified. Each new operator inherits the entire network.'},
]
const WINDOW_RISKS = [
  {risk:'Smartwaiver adds an API',             impact:'Closes the integration gap for their 50,000+ operators',     timeline:'12–24 months'},
  {risk:'DocuSign acquires a vertical player', impact:'Brings enterprise sales motion to activity space',           timeline:'12–36 months'},
  {risk:'FareHarbor builds native waivers',    impact:'Disintermediates the booking platform integration moat',     timeline:'18–36 months'},
]

export default function WhyPage() {
  const [tab,setTab]=useState<Tab>('why')
  const [whySub,setWhySub]=useState<WhySub>('history')
  const [expanded,setExpanded]=useState<string|null>('01')

  return (
    <div className="min-h-screen bg-surface">
      <PageNav badge="Why LIABL" />
      <div className="bg-white border-b border-black/10 px-5">
        <div className="flex gap-0 max-w-3xl mx-auto">
          {([['why','Why now'],['investor','Investor overview'],['demo','Sales Demo']] as [Tab,string][]).map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab===key?'border-brand text-brand':'border-transparent text-gray-500 hover:text-ink'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="bg-ink text-white px-6 py-14 text-center">
        <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{color:'#A78BFA'}}>{
          tab==='why' ? (
            whySub === 'history' ? 'Category history' :
            whySub === 'value'   ? 'Operator value'    :
            'Market thesis'
          ) : tab==='investor' ? 'Investor overview' : 'Sales Demo'
        }</p>
        <h1 className="font-serif text-3xl sm:text-4xl mb-4 max-w-2xl mx-auto leading-tight" style={{letterSpacing:'-0.02em'}}>
          {tab==='why' ? (
            whySub === 'history' ? '25 years of digital signatures. The intelligence gap remains.' :
            whySub === 'value'   ? 'Why operators care — and why they pay more.' :
            'Three forces converging to create a window that closes in 18–36 months.'
          ) : 'The white space, the flywheel, and the five features that build the moat.'}
        </h1>
        <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">
          {tab==='why' ? (
            whySub === 'history' ? 'From the eSign Act in 2000 to the intelligence gap in 2026 — the historical arc of high-risk documents and why this category is overdue for an architectural shift.' :
            whySub === 'value'   ? 'The operator-facing argument for adaptive documents and the premium pricing they justify.' :
            "Activity industry growth, rising liability exposure, and booking platform API maturity have created a moment that didn't exist three years ago."
          ) : tab==='investor' ? "An interactive walkthrough of LIABL's market position, adaptive document intelligence, and the network effect thesis." : 'Choose a buyer persona to launch a scripted, step-by-step demo tailored to their specific pain points and decision criteria.'}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">

        {tab==='why'&&(
          <div className="space-y-6">

            {/* Sub-tab navigation */}
            <div className="flex gap-2 flex-wrap">
              {([['history','Category history'],['forces','Three forces'],['value','Operator value']] as [WhySub,string][]).map(([key,label])=>(
                <button key={key} onClick={()=>setWhySub(key)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    whySub===key
                      ? 'bg-brand text-white'
                      : 'bg-white border border-black/15 text-gray-500 hover:text-ink'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Sub-tab content */}
            {whySub === 'history' && <CategoryHistorySubTab />}
            {whySub === 'value'   && <OperatorValueSubTab />}

            {whySub === 'forces' && (
              <div className="space-y-12">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-6">Three converging forces</p>
                  <div className="space-y-4">
                    {FORCES.map(f=>{
                      const Icon = f.iconName === 'trending' ? IconTrending : f.iconName === 'shield' ? IconShield : IconIntegration
                      return (
                      <div key={f.num} className="bg-white rounded-2xl border border-black/10 overflow-hidden">
                        <div onClick={()=>setExpanded(expanded===f.num?null:f.num)} className="flex items-start gap-4 px-5 py-5 cursor-pointer hover:bg-surface/40 transition-colors">
                          <div className="font-serif text-3xl text-gray-200 font-bold shrink-0 w-10 leading-none mt-1">{f.num}</div>
                          <div className="flex-1">
                            <div className="font-semibold text-base text-ink flex items-center gap-2 mb-0.5"><Icon size={18} color={f.iconColor}/>{f.title}</div>
                            <div className="text-sm text-gray-400 mb-3">{f.sub}</div>
                            <div className="flex gap-3 flex-wrap">
                              {f.stats.map(s=>(<div key={s.label} className={`rounded-lg border px-3 py-2 ${f.bg}`}><div className={`font-semibold text-lg leading-none mb-0.5 ${f.color}`}>{s.value}</div><div className="text-xs text-gray-500">{s.label}</div></div>))}
                            </div>
                          </div>
                          <span className="text-gray-400 text-sm shrink-0">{expanded===f.num?'▲':'▼'}</span>
                        </div>
                        {expanded===f.num&&(
                          <div className="border-t border-black/8 px-5 py-5 bg-surface/30">
                            {f.body.split('\n\n').map((para,i)=>(<p key={i} className="text-sm text-gray-600 leading-relaxed mb-3 last:mb-0">{para}</p>))}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-4">The window — and why it closes</p>
                  <div className="space-y-3 mb-8">
                    {WINDOW_RISKS.map(r=>(<div key={r.risk} className="bg-white rounded-xl border border-black/10 p-4"><div className="flex items-start justify-between gap-3 flex-wrap mb-2"><div className="font-semibold text-sm text-ink">{r.risk}</div><span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-full shrink-0">{r.timeline}</span></div><div className="text-xs text-gray-400 leading-relaxed">{r.impact}</div></div>))}
                  </div>
                </div>
                <div className="bg-brand rounded-2xl p-6 text-white">
                  <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-white/60">LIABL&apos;s answer</p>
                  <h2 className="font-serif text-2xl mb-3" style={{letterSpacing:'-0.01em'}}>The moat is the data, not the feature.</h2>
                  <p className="text-white/80 text-sm leading-relaxed mb-5">Any competitor can build adaptive waivers. Nobody can buy five years of signed participant data across thousands of operators. At 5,000 operators, a new operator joining LIABL inherits 68% participant recognition on day one.</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[{value:'Year 1–2',label:'Build the document layer',sub:'Adaptive engine, Pass, integrations'},{value:'Year 2–3',label:'Build the network',sub:'Cross-operator graph compounds'},{value:'Year 3–5',label:'The moat is defensible',sub:'68% recognition at 5K operators'}].map(({value,label,sub})=>(<div key={value} className="bg-white/10 rounded-xl p-4 text-center"><div className="font-semibold text-sm mb-1">{value}</div><div className="text-xs text-white/80 leading-snug mb-1">{label}</div><div className="text-xs text-white/50 leading-snug">{sub}</div></div>))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {tab==='demo'    && <SalesDemo /> }

        {tab==='investor'&&(
          <div className="space-y-14">
            <section>
              <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Market White Space</p>
              <h2 className="font-serif text-2xl text-ink mb-3" style={{letterSpacing:'-0.01em'}}>The activity industry has been running on form-first software for 20 years. LIABL is the first AI-native alternative.</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-5 max-w-2xl">
                The incumbents in this category were built as digital versions of paper forms — they store documents, they don&apos;t generate intelligence from them.
                LIABL was architected differently from the ground up: every answer is a signal, every signature builds an identity, every operator makes the network smarter.
                That is not a feature difference. It is an architectural one. Legacy tools cannot replicate it by adding AI on top.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {COMPETITORS.map(c=>(<div key={c.name} className="bg-white rounded-xl border border-black/10 p-4"><div className="flex items-center justify-between mb-2"><div className="font-semibold text-sm text-ink">{c.name}</div><span className="text-xs bg-surface border border-black/10 px-2 py-0.5 rounded-full text-gray-400">{c.cap}</span></div><div className="text-xs text-gray-400 leading-relaxed">{c.gap}</div></div>))}
              </div>
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-5 flex items-start gap-3"><div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white text-sm font-bold shrink-0">L</div><div><div className="font-semibold text-ink mb-1">Why legacy tools cannot close this gap</div><div className="text-sm text-gray-500 leading-relaxed">Adding AI features to a form tool does not make it AI-native. The participant identity graph requires years of cross-operator signing data to become defensible. The adaptive document engine requires architecture built around inference, not templates. LIABL is building this now. The window to build it defensibly closes as the market matures.</div></div></div>
            </section>
            <section>
              <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Five differentiating features</p>
              <div className="space-y-3 mb-10">
                {FIVE_FEATURES.map(f=>(<div key={f.num} className="flex gap-5 bg-white rounded-2xl border border-black/10 p-5"><div className="font-serif text-3xl text-brand/20 font-bold shrink-0 w-10">{f.num}</div><div className="flex-1"><div className="flex items-start justify-between gap-3 flex-wrap mb-1"><div className="font-semibold text-ink">{f.title}</div><span className="text-xs bg-surface border border-black/10 px-2.5 py-1 rounded-full text-gray-400 shrink-0">{f.phase}</span></div><p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p></div></div>))}
              </div>
              <div className="bg-white rounded-2xl border border-black/10 p-6 mb-8">
                <span className="text-xs font-semibold tracking-widest text-brand uppercase">Feature 01 · Live demo</span>
                <h2 className="font-serif text-xl text-ink mt-1 mb-2" style={{letterSpacing:'-0.01em'}}>Adaptive document intelligence</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">The document builds itself from participant answers in real time. Try it below.</p>
                <AdaptiveDemo/>
              </div>
              <div className="bg-ink rounded-2xl p-6">
                <span className="text-xs font-semibold tracking-widest uppercase" style={{color:'#A78BFA'}}>Feature 05 · Live simulator</span>
                <h2 className="font-serif text-xl text-white mt-1 mb-2" style={{letterSpacing:'-0.01em'}}>Document network effect</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">Drag the slider to see the flywheel in motion.</p>
                <NetworkDemo/>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
