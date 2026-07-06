'use client'
import { useState } from 'react'

interface Location {
  id:          string
  name:        string
  city:        string
  state:       string
  manager:     string
  activities:  string[]
  todaySigned: number
  todayTotal:  number
  exceptions:  number
  incidents:   number
  riskAvg:     number
  riskLevel:   'low'|'moderate'|'elevated'|'high'
  status:      'active'|'warning'|'alert'
}

const LOCATIONS: Location[] = [
  { id:'l1', name:'Desert Ridge Adventures',   city:'Scottsdale',  state:'AZ', manager:'J. Torres',    activities:['Kayaking','ATV','Climbing','Hiking'], todaySigned:47, todayTotal:52, exceptions:2, incidents:0, riskAvg:38, riskLevel:'moderate', status:'warning' },
  { id:'l2', name:'Tucson Adventure Co.',      city:'Tucson',      state:'AZ', manager:'R. Campos',   activities:['ATV','Hiking'],                       todaySigned:31, todayTotal:31, exceptions:0, incidents:0, riskAvg:29, riskLevel:'low',      status:'active'  },
  { id:'l3', name:'Flagstaff Summit Guides',   city:'Flagstaff',   state:'AZ', manager:'A. Whitehorse',activities:['Climbing','Hiking'],                  todaySigned:18, todayTotal:24, exceptions:1, incidents:1, riskAvg:51, riskLevel:'elevated', status:'alert'   },
  { id:'l4', name:'Sedona Canyon Tours',       city:'Sedona',      state:'AZ', manager:'M. Reyes',    activities:['Hiking','Kayaking'],                  todaySigned:29, todayTotal:30, exceptions:0, incidents:0, riskAvg:24, riskLevel:'low',      status:'active'  },
  { id:'l5', name:'Phoenix Urban Climb',       city:'Phoenix',     state:'AZ', manager:'S. Park',     activities:['Climbing'],                           todaySigned:62, todayTotal:68, exceptions:3, incidents:0, riskAvg:44, riskLevel:'moderate', status:'warning' },
]

const STATUS_CONFIG = {
  active:  { color:'text-slate-deep', bg:'bg-slate-light', border:'border-slate/25', dot:'bg-slate', label:'All clear'  },
  warning: { color:'text-amber-700',   bg:'bg-amber-50',    border:'border-amber-200',   dot:'bg-amber-500',   label:'Needs attention' },
  alert:   { color:'text-red-700',     bg:'bg-red-50',      border:'border-red-200',     dot:'bg-red-500',     label:'Action required' },
}

const RISK_COLORS = {
  low:      'text-emerald-600',
  moderate: 'text-blue-600',
  elevated: 'text-amber-600',
  high:     'text-red-600',
}

type SortKey = 'name'|'signed'|'exceptions'|'risk'

export default function MultiLocationTab() {
  const [selected, setSelected] = useState<string|null>(null)
  const [sortBy,   setSortBy]   = useState<SortKey>('name')
  const [dateRange,setDateRange]= useState('today')

  const totalSigned     = LOCATIONS.reduce((s,l) => s+l.todaySigned, 0)
  const totalTotal      = LOCATIONS.reduce((s,l) => s+l.todayTotal, 0)
  const totalExceptions = LOCATIONS.reduce((s,l) => s+l.exceptions, 0)
  const totalIncidents  = LOCATIONS.reduce((s,l) => s+l.incidents, 0)
  const overallPct      = Math.round(totalSigned/totalTotal*100)

  const sorted = [...LOCATIONS].sort((a,b) => {
    if (sortBy === 'signed')     return (b.todaySigned/b.todayTotal) - (a.todaySigned/a.todayTotal)
    if (sortBy === 'exceptions') return b.exceptions - a.exceptions
    if (sortBy === 'risk')       return b.riskAvg - a.riskAvg
    return a.name.localeCompare(b.name)
  })

  const selectedLoc = LOCATIONS.find(l => l.id === selected)

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl" style={{ letterSpacing:'-0.01em' }}>Multi-Location Overview</h1>
          <p className="text-sm text-gray-400 mt-1">Desert Ridge Operator Group · 5 locations · Arizona</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="form-input text-sm py-2" value={dateRange} onChange={e=>setDateRange(e.target.value)}
            style={{ width:'auto' }}>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
        </div>
      </div>

      {/* Network KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label:'Network signed',   value:`${totalSigned}/${totalTotal}`, sub:`${overallPct}% completion`, color:'text-brand'        },
          { label:'Active locations', value:'5',                            sub:'All online',                color:'text-emerald-600'  },
          { label:'Open exceptions',  value:totalExceptions,                sub:'Across all locations',      color:totalExceptions>0?'text-amber-600':'text-emerald-600' },
          { label:'Open incidents',   value:totalIncidents,                 sub:'Requiring follow-up',       color:totalIncidents>0?'text-red-600':'text-emerald-600'    },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-black/10 p-4">
            <div className={`text-2xl font-semibold mb-1 ${color}`} style={{ letterSpacing:'-0.02em' }}>{value}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Network completion bar */}
      <div className="bg-white rounded-xl border border-black/10 p-4 mb-6">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-ink">Network signing completion — {dateRange}</span>
          <span className="text-brand font-semibold">{overallPct}%</span>
        </div>
        <div className="h-3 bg-black/8 rounded-full overflow-hidden mb-3">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width:`${overallPct}%` }} />
        </div>
        {/* Per-location mini bars */}
        <div className="space-y-2">
          {LOCATIONS.map(l => {
            const pct = Math.round(l.todaySigned/l.todayTotal*100)
            return (
              <div key={l.id} className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 w-40 truncate shrink-0">{l.name}</span>
                <div className="flex-1 h-1.5 bg-black/8 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct===100?'bg-emerald-500':pct>80?'bg-brand':'bg-amber-500'}`}
                    style={{ width:`${pct}%` }} />
                </div>
                <span className="text-gray-400 w-12 text-right">{l.todaySigned}/{l.todayTotal}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Location table */}
      <div className="bg-white rounded-2xl border border-black/10 overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/8">
          <span className="text-sm font-medium">All Locations</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Sort by:</span>
            <div className="flex gap-1">
              {([['name','Name'],['signed','Completion'],['exceptions','Exceptions'],['risk','Risk']] as [SortKey,string][]).map(([key,label])=>(
                <button key={key} onClick={()=>setSortBy(key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${sortBy===key?'bg-brand text-white':'bg-surface text-gray-500 hover:bg-black/5'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sorted.map(l => {
          const pct  = Math.round(l.todaySigned/l.todayTotal*100)
          const sc   = STATUS_CONFIG[l.status]
          const isOpen = selected === l.id
          return (
            <div key={l.id}>
              <div onClick={() => setSelected(isOpen ? null : l.id)}
                className={`flex items-center gap-3 px-5 py-4 border-b border-black/5 cursor-pointer transition-colors hover:bg-surface/60 ${isOpen?'bg-brand/5':''}`}>
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sc.dot}`} />
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-ink">{l.name}</div>
                  <div className="text-xs text-gray-400">{l.city}, {l.state} · {l.manager}</div>
                </div>
                {/* Completion */}
                <div className="text-center shrink-0 w-20">
                  <div className="text-sm font-semibold text-ink">{pct}%</div>
                  <div className="text-xs text-gray-400">{l.todaySigned}/{l.todayTotal}</div>
                </div>
                {/* Exceptions */}
                <div className="text-center shrink-0 w-16">
                  <div className={`text-sm font-semibold ${l.exceptions>0?'text-amber-600':'text-gray-300'}`}>{l.exceptions}</div>
                  <div className="text-xs text-gray-400">exceptions</div>
                </div>
                {/* Risk */}
                <div className="text-center shrink-0 w-16">
                  <div className={`text-sm font-semibold ${RISK_COLORS[l.riskLevel]}`}>{l.riskAvg}</div>
                  <div className="text-xs text-gray-400">avg risk</div>
                </div>
                {/* Status badge */}
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium shrink-0 ${sc.bg} ${sc.border} ${sc.color}`}>
                  {sc.label}
                </span>
                <span className="text-gray-400 text-xs">{isOpen?'▲':'▼'}</span>
              </div>

              {/* Expanded location detail */}
              {isOpen && (
                <div className="border-t border-brand/10 bg-brand/5 px-5 py-4 animate-fade-up">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Location Details</div>
                      <div className="space-y-1 text-xs">
                        {[
                          { l:'Manager',   v:l.manager },
                          { l:'City',      v:`${l.city}, ${l.state}` },
                          { l:'Activities',v:l.activities.join(', ') },
                          { l:'Status',    v:sc.label },
                        ].map(({l:label,v})=>(
                          <div key={label} className="flex gap-3">
                            <span className="text-gray-400 w-20 shrink-0">{label}</span>
                            <span className="text-ink font-medium">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Today&apos;s Activity</div>
                      <div className="space-y-1 text-xs">
                        {[
                          { l:'Signed',    v:`${l.todaySigned} of ${l.todayTotal}` },
                          { l:'Completion',v:`${pct}%` },
                          { l:'Exceptions',v:l.exceptions > 0 ? `${l.exceptions} open` : 'None' },
                          { l:'Incidents', v:l.incidents > 0 ? `${l.incidents} open` : 'None' },
                        ].map(({l:label,v})=>(
                          <div key={label} className="flex gap-3">
                            <span className="text-gray-400 w-20 shrink-0">{label}</span>
                            <span className="text-ink font-medium">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Risk Profile</div>
                      <div className="bg-white rounded-xl border border-black/10 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">Average AI Risk Score</span>
                          <span className={`text-lg font-bold ${RISK_COLORS[l.riskLevel]}`}>{l.riskAvg}</span>
                        </div>
                        <div className="h-2 bg-black/8 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width:`${l.riskAvg}%`, background: l.riskLevel==='low'?'#059669':l.riskLevel==='moderate'?'#2563EB':l.riskLevel==='elevated'?'#D97706':'#DC2626' }} />
                        </div>
                        <div className="text-xs text-gray-400 mt-1 capitalize">{l.riskLevel} risk</div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button className="flex-1 py-2 text-xs font-medium bg-brand text-white rounded-xl hover:opacity-90">View dashboard</button>
                        <button className="flex-1 py-2 text-xs font-medium border border-black/20 text-gray-600 rounded-xl hover:bg-white">Export data</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Enterprise callout */}
      <div className="bg-ink rounded-2xl p-5 text-white">
        <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color:'#A78BFA' }}>Enterprise Feature</div>
        <h3 className="font-serif text-lg mb-2" style={{ letterSpacing:'-0.01em' }}>Multi-location management is available on Enterprise plans.</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          Unified reporting across all locations, role-based access per location, consolidated incident management,
          and volume pricing. Perfect for resort groups, franchise operators, and school districts.
        </p>
        <button className="py-2.5 px-5 bg-white text-ink rounded-xl text-sm font-semibold hover:bg-white/90 transition-all">
          Contact sales →
        </button>
      </div>
    </div>
  )
}
