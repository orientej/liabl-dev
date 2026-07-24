'use client'
import { useState } from 'react'
import { IconTrending, IconRiskBadge, IconAnalytics, IconAuditTrail, IconAlert, IconNetwork, IconShield } from '@/components/icons'

// ── Operator value prop data ──────────────────────────────────
const VALUE_PROPS = [
  {
    Icon:IconTrending,
    iconColor:'#15803D',
    title:'Premium discounts of 8–15%',
    desc:'Carriers like K&K and Markel offer documented discounts to operators who can demonstrate structured, digitally-verified waiver practices. LIABL\'s audit trail and document integrity certificates meet the criteria for preferred underwriting tiers — most operators see 8–15% premium reductions at renewal.',
    badge:'Avg. $1,200–$3,800/yr saved',
    badgeColor:'bg-success-light text-success-deep border-success/20',
  },
  {
    Icon:IconRiskBadge,
    iconColor:'#2563EB',
    title:'Claims resolved 40% faster',
    desc:'Operators with LIABL-documented waivers see average claims resolution 40% faster because chain of custody is already established at the moment of incident. No discovery delays, no missing paperwork, no disputed signing dates. Your carrier has everything they need within seconds of the incident webhook firing.',
    badge:'Avg. 40% faster resolution',
    badgeColor:'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    Icon:IconAnalytics,
    iconColor:'#4B2ACF',
    title:'Preferred underwriting status',
    desc:'Operators who share anonymized LIABL risk data with their carrier — activity volume, risk score distribution, exception rates — qualify for preferred underwriting tiers. Lower risk scores translate directly to lower premiums at renewal. LIABL generates the underwriting export automatically; you approve and send.',
    badge:'Preferred rate qualification',
    badgeColor:'bg-brand/10 text-brand border-brand/20',
  },
  {
    Icon:IconAlert,
    iconColor:'#D97706',
    title:'Zero missed claim windows',
    desc:'When a legal hold is applied in LIABL, an automatic incident notification fires to your carrier\'s claims intake endpoint within seconds. No missed claim windows, no phone tag, no faxed incident forms. Your carrier opens a file before you\'ve finished the incident report.',
    badge:'Automatic carrier notification',
    badgeColor:'bg-amber-50 text-amber-700 border-amber-200',
  },
]

const CARRIERS = [
  {
    id:'kk', name:'K&K Insurance', logoLetters:'KK', logoColor:'#1E3A8A', specialty:'Outdoor & adventure activities', connected:true, since:'Connected Apr 2026',
    outbound:['Activity type & volume by month','Participant age distribution','Exception rate trends','Health disclosure frequency (anonymized)','Incident-flagged document count'],
    inbound: ['Policy number & coverage dates','Activity exclusion list','Underwriting conditions','Preferred rate qualifications','Claim intake webhook endpoint'],
    incidentWebhook: true,
  },
  {
    id:'markel', name:'Markel Specialty', logoLetters:'MK', logoColor:'#15803D', specialty:'Recreation & sports liability', connected:true, since:'Connected Feb 2026',
    outbound:['Signed document integrity certificates','Waiver completion rate','Guardian signature rate for minors','Average time from booking to waiver'],
    inbound: ['Policy terms & activity riders','Coverage confirmation per session','Renewal reminder triggers'],
    incidentWebhook: true,
  },
  {
    id:'phly', name:'Philadelphia Insurance', logoLetters:'PH', logoColor:'#7C3AED', specialty:'Youth sports & camps', connected:false, since:null,
    outbound:[], inbound:[], incidentWebhook:false,
  },
  {
    id:'cna', name:'CNA Financial', logoLetters:'CNA', logoColor:'#DC2626', specialty:'Enterprise & multi-location', connected:false, since:null,
    outbound:[], inbound:[], incidentWebhook:false,
  },
  {
    id:'berkley', name:'W.R. Berkley', logoLetters:'WRB', logoColor:'#0891B2', specialty:'Fitness & wellness facilities', connected:false, since:null,
    outbound:[], inbound:[], incidentWebhook:false,
  },
]

const EXPORT_FIELDS = [
  { id:'volume',     label:'Signing volume by activity',        included:true  },
  { id:'age',        label:'Participant age distribution',       included:true  },
  { id:'exceptions', label:'Exception rates (guardian, health)', included:true  },
  { id:'completion', label:'Booking-to-waiver completion time',  included:true  },
  { id:'returning',  label:'Returning participant rate',         included:true  },
  { id:'incidents',  label:'Incident-flagged document count',    included:false },
  { id:'health',     label:'Health disclosure frequency (anon)', included:false },
  { id:'override',   label:'Supervisor override count',          included:false },
]

const INCIDENT_LOG = [
  { time:'Jun 3, 9:44 AM', carrier:'K&K Insurance',    ref:'INC-2024-0041', participant:'Jamie Lee',   activity:'ATV Tour',     status:'delivered',  ms:234  },
  { time:'May 28, 2:11 PM',carrier:'Markel Specialty',  ref:'INC-2024-0039', participant:'Alex Torres', activity:'Rock Climbing', status:'delivered',  ms:189  },
  { time:'May 15, 11:03 AM',carrier:'K&K Insurance',   ref:'INC-2024-0037', participant:'Sam Rivera',  activity:'Kayaking',     status:'failed',     ms:null },
  { time:'May 15, 11:03 AM',carrier:'K&K Insurance',   ref:'INC-2024-0037', participant:'Sam Rivera',  activity:'Kayaking',     status:'delivered',  ms:312  },
]

const INTELLIGENCE_ITEMS = [
  { icon:'📊', title:'Real-time risk scoring',       desc:'LIABL analyzes participant answers — age, health, activity, experience — and produces a risk score visible to the operator at check-in and shared with the carrier.', phase:'Year 2' },
  { icon:'🔄', title:'Dynamic underwriting signals', desc:'High exception rates on a specific activity trigger an automatic rate review flag with the carrier. Operators are notified before renewal.', phase:'Year 2' },
  { icon:'🏆', title:'Preferred rate qualification', desc:'Low incident history and high document quality scores qualify operators for preferred rates automatically — no broker intervention needed.', phase:'Year 3' },
  { icon:'⚡', title:'Instant coverage confirmation', desc:'At activity start, LIABL fires a coverage confirmation check to the carrier. If policy is lapsed or activity is excluded, the operator is alerted before the session begins.', phase:'Year 3' },
]

export default function InsuranceTab() {
  const [expanded, setExpanded]       = useState<string|null>('kk')
  const [exportFields, setExportFields] = useState(EXPORT_FIELDS)
  const [dateRange,  setDateRange]    = useState('last_90')
  const [exporting,  setExporting]    = useState(false)
  const [exported,   setExported]     = useState(false)

  function doExport() {
    setExporting(true)
    setTimeout(() => { setExporting(false); setExported(true); setTimeout(() => setExported(false), 3000) }, 1400)
  }

  function toggleField(id: string) {
    setExportFields(f => f.map(field => field.id === id ? { ...field, included: !field.included } : field))
  }

  return (
    <div className="space-y-10">

      {/* Intro */}
      <div>
        <h2 className="font-serif text-xl mb-1" style={{ letterSpacing:'-0.01em' }}>Insurance integrations</h2>
        <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
          LIABL's signed document data — activity type, participant demographics, health disclosures,
          exception rates, and incident flags — is exactly what activity insurers need for underwriting.
          Connect your carrier to automate data sharing, incident notifications, and coverage confirmation.
        </p>
      </div>

      {/* Operator value prop */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-2">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl shrink-0">💵</span>
          <div>
            <h3 className="font-semibold text-ink mb-1">What this is worth to your business</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              LIABL&apos;s insurance integration isn&apos;t a compliance checkbox — it&apos;s a direct line to lower premiums,
              faster claims, and better carrier relationships. Here&apos;s the tangible value for operators.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VALUE_PROPS.map(v => (
            <div key={v.title} className="bg-white rounded-xl border border-black/10 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <v.Icon size={20} color={v.iconColor}/>
                  <span className="font-semibold text-sm text-ink">{v.title}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${v.badgeColor}`}>{v.badge}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-white rounded-xl border border-emerald-200 p-4">
          <div className="text-sm font-semibold text-ink mb-2">Bottom line for a typical adventure operator</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              {label:'Annual premium (before LIABL)', value:'$18,500', sub:'Typical adventure operator'},
              {label:'Estimated savings (10%)',        value:'$1,850/yr', sub:'From preferred tier qualification'},
              {label:'vs. Intelligence plan cost',     value:'$4,188/yr', sub:'$349/mo × 12'},
            ].map(({label,value,sub})=>(
              <div key={label} className="bg-surface rounded-lg p-3">
                <div className="text-gray-400 mb-1">{label}</div>
                <div className="font-semibold text-brand text-base">{value}</div>
                <div className="text-gray-400">{sub}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Premium savings alone offset a significant portion of the Intelligence plan cost — before accounting for staff time, faster claims, or legal exposure reduction.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon:'→', title:'Outbound data',       desc:'LIABL sends anonymized risk and compliance data to your carrier at renewal intervals or on demand.' },
          { icon:'←', title:'Inbound policy data', desc:'Carrier sends policy terms, coverage conditions, and activity exclusions back to LIABL — surfaced in operator dashboard.' },
          { icon:'⚡', title:'Incident webhooks',   desc:'When a legal hold is applied, LIABL fires an automatic notification to the carrier\'s claims intake endpoint within seconds.' },
        ].map(p => (
          <div key={p.title} className="bg-white rounded-xl border border-black/10 p-4">
            <div className="text-2xl mb-2 font-bold text-brand">{p.icon}</div>
            <div className="font-semibold text-sm text-ink mb-1">{p.title}</div>
            <p className="text-xs text-gray-400 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Carrier list */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Connected carriers</div>
        <div className="space-y-3">
          {CARRIERS.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-black/10 overflow-hidden">
              <div onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface/40 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0" style={{ background: c.logoColor }}>{c.logoLetters}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-ink">{c.name}</span>
                    {c.connected && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Connected</span>}
                    {c.incidentWebhook && c.connected && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">⚡ Incident webhook</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{c.connected ? c.since : 'Not connected'} · {c.specialty}</div>
                </div>
                <span className="text-gray-400 text-sm">{expanded === c.id ? '▲' : '▼'}</span>
              </div>

              {expanded === c.id && (
                <div className="border-t border-black/8 px-5 py-5 bg-surface/30">
                  {c.connected ? (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">→ Outbound to carrier</div>
                          <div className="space-y-1.5">
                            {c.outbound.map(item => (
                              <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                                <span className="text-brand shrink-0">✓</span>{item}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">← Inbound from carrier</div>
                          <div className="space-y-1.5">
                            {c.inbound.map(item => (
                              <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                                <span className="text-emerald-500 shrink-0">✓</span>{item}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {c.incidentWebhook && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                          <div className="text-xs font-semibold text-amber-700 mb-2">⚡ Incident webhook configured</div>
                          <div className="font-mono text-xs text-amber-800 mb-2">POST https://claims.{c.id}.com/liabl/incident</div>
                          <div className="text-xs text-amber-700 leading-relaxed">Fires automatically when a legal hold is applied. Payload includes document ID, incident timestamp, activity type, participant age group, and waiver integrity certificate.</div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button className="text-sm px-4 py-2 rounded-xl border border-black/20 text-gray-600 hover:bg-white transition-colors">Configure</button>
                        <button className="text-sm px-4 py-2 rounded-xl border border-black/20 text-gray-600 hover:bg-white transition-colors">Test connection</button>
                        <button className="text-sm px-4 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors">Disconnect</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Connect {c.name} to automate data sharing and incident notifications.
                        You&apos;ll need your policy number and the API key from your {c.name} broker portal.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs text-gray-500 mb-1">Policy number</label><input className="form-input" placeholder="POL-XXXXXXXX"/></div>
                        <div><label className="block text-xs text-gray-500 mb-1">API key</label><input className="form-input" placeholder="Paste API key…"/></div>
                      </div>
                      <button className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors">Connect {c.name}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Data export for underwriting */}
      <div>
        <h3 className="font-serif text-lg mb-1" style={{ letterSpacing:'-0.01em' }}>Underwriting data export</h3>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-2xl">
          Generate a structured risk profile to share with your broker or carrier at renewal time.
          Select the fields to include and the date range.
        </p>
        <div className="bg-white rounded-2xl border border-black/10 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            {/* Field selector */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Select data fields</div>
              <div className="space-y-2">
                {exportFields.map(field => (
                  <div key={field.id} onClick={() => toggleField(field.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      field.included ? 'border-brand bg-brand/5' : 'border-black/10 bg-surface hover:border-brand/30'
                    }`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 transition-all ${field.included ? 'border-brand bg-brand' : 'border-gray-300'}`}>
                      {field.included && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <span className="text-xs text-ink">{field.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Export preview</div>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Date range</label>
                <select className="form-input" value={dateRange} onChange={e => setDateRange(e.target.value)}>
                  <option value="last_30">Last 30 days</option>
                  <option value="last_90">Last 90 days</option>
                  <option value="last_365">Last 12 months</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>
              <div className="bg-ink rounded-xl p-4 font-mono text-xs text-green-400 overflow-x-auto">
                <div className="text-gray-500 mb-1">{`// Underwriting export — Desert Ridge Adventures`}</div>
                <div>{`{`}</div>
                <div className="ml-3 text-gray-300">{`"operator": "Desert Ridge Adventures",`}</div>
                <div className="ml-3 text-gray-300">{`"period": "Last 90 days",`}</div>
                <div className="ml-3 text-gray-300">{`"generated": "${new Date().toISOString().split('T')[0]}",`}</div>
                {exportFields.filter(f => f.included).slice(0,4).map(f => (
                  <div key={f.id} className="ml-3">{`"${f.id}": {...},`}</div>
                ))}
                <div className="ml-3 text-gray-500">{`// + ${exportFields.filter(f => f.included).length - 4 > 0 ? exportFields.filter(f => f.included).length - 4 : 0} more fields`}</div>
                <div>{`}`}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-black/8">
            <button onClick={doExport}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                exported ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-brand text-white hover:opacity-90'
              }`}>
              {exporting ? '⟳ Generating…' : exported ? '✓ Downloaded' : '↓ Download PDF report'}
            </button>
            <button onClick={doExport} className="px-5 py-2.5 rounded-xl border border-black/20 text-gray-600 text-sm hover:bg-surface transition-all">
              Export JSON
            </button>
            <button className="px-5 py-2.5 rounded-xl border border-black/20 text-gray-600 text-sm hover:bg-surface transition-all">
              Send to broker ✉
            </button>
          </div>
        </div>
      </div>

      {/* Incident notification log */}
      <div>
        <h3 className="font-serif text-lg mb-1" style={{ letterSpacing:'-0.01em' }}>Incident notification log</h3>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-2xl">
          Every time a legal hold is applied, LIABL automatically notifies the connected carrier.
          All deliveries logged here with full payload details.
        </p>
        <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-black/8 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-2">Time</div>
            <div className="col-span-2">Carrier</div>
            <div className="col-span-2">Ref</div>
            <div className="col-span-2">Participant</div>
            <div className="col-span-2">Activity</div>
            <div className="col-span-2">Status</div>
          </div>
          {INCIDENT_LOG.map((e, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-black/5 last:border-0 items-center text-xs">
              <div className="col-span-2 text-gray-400 font-mono text-xs">{e.time}</div>
              <div className="col-span-2 text-gray-600">{e.carrier}</div>
              <div className="col-span-2 font-mono text-gray-400">{e.ref}</div>
              <div className="col-span-2 text-ink font-medium">{e.participant}</div>
              <div className="col-span-2 text-gray-500">{e.activity}</div>
              <div className="col-span-2">
                {e.status === 'delivered'
                  ? <span className="text-emerald-600 font-medium">✓ {e.ms}ms</span>
                  : <span className="text-red-500 font-medium">✗ failed</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Insurance intelligence roadmap */}
      <div>
        <h3 className="font-serif text-lg mb-1" style={{ letterSpacing:'-0.01em' }}>Insurance intelligence <span className="text-sm font-sans text-gray-400 font-normal">· Roadmap</span></h3>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-2xl">
          Where LIABL&apos;s insurance layer is heading — transforming from a data pipe into a real-time
          risk management platform that benefits both operators and carriers.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTELLIGENCE_ITEMS.map(item => (
            <div key={item.title} className="bg-white rounded-2xl border border-black/10 p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-semibold text-sm text-ink">{item.title}</span>
                </div>
                <span className="text-xs bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-full shrink-0">{item.phase}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
