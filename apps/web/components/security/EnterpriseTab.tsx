'use client'
import { useState } from 'react'

const ROLES = [
  { id:'owner',   name:'Owner',   color:'#4B2ACF', perms:['All permissions','Billing & subscription','Delete operator account','Manage all roles','Export all data','View all waivers','Override exceptions','Apply legal holds','Manage templates'] },
  { id:'manager', name:'Manager', color:'#059669', perms:['View all waivers','Override exceptions','Apply legal holds','Manage templates','Staff notes','Add addendums','Export CSV','View analytics'] },
  { id:'staff',   name:'Staff',   color:'#0891B2', perms:['Check-in roster (signed/pending status only)','Scan to verify','Add staff notes','Cannot view health disclosures','Cannot export data'] },
]

const LIFECYCLE_EVENTS = [
  { doc:'doc_a1b2', event:'retention_review', date:'Jun 3, 2029',   note:'3-year retention threshold — review for extension or archive' },
  { doc:'doc_c3d4', event:'legal_hold',       date:'Active',        note:'Legal hold applied Jun 3, 2026 — retention suspended until released' },
  { doc:'doc_e5f6', event:'archived',         date:'Jun 3, 2026',   note:'Document archived per 90-day Core plan policy' },
]

const METADATA_TAGS = ['high-season','group-booking','youth-program','medical-flag','vip-participant','first-time']

export default function EnterpriseTab() {
  const [selectedRole, setSelectedRole] = useState('owner')
  const [activeTags,   setActiveTags]   = useState<string[]>(['youth-program','medical-flag'])
  const [holdApplied,  setHoldApplied]  = useState(false)

  const role = ROLES.find(r => r.id === selectedRole)!

  function toggleTag(tag: string) {
    setActiveTags(t => t.includes(tag) ? t.filter(x=>x!==tag) : [...t,tag])
  }

  return (
    <div className="space-y-10">

      {/* RBAC */}
      <div>
        <h2 className="font-serif text-xl mb-1" style={{ letterSpacing:'-0.01em' }}>Role-based access control</h2>
        <p className="text-sm text-gray-500 mb-4 max-w-2xl leading-relaxed">
          Three permission tiers control exactly what each staff member can see and do.
          Health disclosures and waiver content are never visible to Staff — only actionable status.
        </p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {ROLES.map(r => (
            <button key={r.id} onClick={() => setSelectedRole(r.id)}
              className={`text-left p-4 rounded-2xl border transition-all ${selectedRole===r.id ? 'border-2' : 'border-black/10 bg-white hover:border-black/20'}`}
              style={selectedRole===r.id ? { borderColor:r.color, background:r.color+'10' } : {}}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold mb-2" style={{ background:r.color }}>{r.name[0]}</div>
              <div className="font-semibold text-ink text-sm">{r.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{r.perms.length} permissions</div>
            </button>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-black/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ background:role.color }}>{role.name[0]}</div>
            <span className="font-semibold text-sm text-ink">{role.name} permissions</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {role.perms.map(p => (
              <div key={p} className="flex items-center gap-2 text-xs">
                <span style={{ color:role.color }} className="shrink-0">✓</span>
                <span className="text-gray-600">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metadata tagging */}
      <div>
        <h2 className="font-serif text-xl mb-1" style={{ letterSpacing:'-0.01em' }}>Metadata tagging</h2>
        <p className="text-sm text-gray-500 mb-4 max-w-2xl leading-relaxed">
          Apply custom metadata tags to waivers and sessions for structured filtering, reporting,
          and automated retention policy triggers.
        </p>
        <div className="bg-white rounded-2xl border border-black/10 p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tags — doc_a1b2c3d4</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {METADATA_TAGS.map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  activeTags.includes(tag) ? 'bg-brand/10 text-brand border-brand/30' : 'bg-surface text-gray-500 border-black/10 hover:border-brand/30'
                }`}>
                {activeTags.includes(tag) ? '✓ ' : '+ '}{tag}
              </button>
            ))}
          </div>
          {activeTags.length > 0 && (
            <div className="bg-surface rounded-xl p-3 text-xs text-gray-500">
              Active tags: <span className="font-mono text-ink">[{activeTags.map(t=>`"${t}"`).join(', ')}]</span>
              <span className="ml-2 text-gray-400">— filterable via API and export</span>
            </div>
          )}
        </div>
      </div>

      {/* Document lifecycle */}
      <div>
        <h2 className="font-serif text-xl mb-1" style={{ letterSpacing:'-0.01em' }}>Document lifecycle management</h2>
        <p className="text-sm text-gray-500 mb-4 max-w-2xl leading-relaxed">
          LIABL enforces retention policies automatically based on your plan tier and jurisdiction requirements.
          Legal holds suspend all retention timers until manually released.
        </p>

        {/* Legal hold demo */}
        <div className="bg-white rounded-2xl border border-black/10 p-5 mb-4">
          <div className="text-sm font-semibold text-ink mb-3">Apply legal hold — doc_c3d4e5f6</div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500 leading-relaxed flex-1">
              Legal hold prevents document expiry and deletion. Applied automatically on incident report filing.
              Can also be manually applied by Owner or Manager role.
            </p>
            <button onClick={() => setHoldApplied(!holdApplied)}
              className={`text-sm px-4 py-2 rounded-xl border font-medium transition-all shrink-0 ${
                holdApplied ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}>
              {holdApplied ? '✓ Hold active — click to release' : '🔒 Apply legal hold'}
            </button>
          </div>
          {holdApplied && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 animate-fade-up">
              Legal hold applied at {new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} — document retention timer suspended.
              Carrier notified via incident webhook. Document cannot be deleted until hold is released.
            </div>
          )}
        </div>

        {/* Lifecycle events */}
        <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-black/8 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Upcoming lifecycle events
          </div>
          {LIFECYCLE_EVENTS.map((e, i) => (
            <div key={i} className="flex items-start gap-4 px-5 py-4 border-b border-black/5 last:border-0">
              <div className="font-mono text-xs text-gray-400 w-24 shrink-0 mt-0.5">{e.doc}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    e.event==='legal_hold' ? 'bg-amber-50 text-amber-700' :
                    e.event==='archived'   ? 'bg-gray-100 text-gray-600' :
                    'bg-brand/10 text-brand'
                  }`}>{e.event}</span>
                  <span className="text-xs text-gray-400">{e.date}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{e.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Retention tiers */}
      <div className="bg-surface border border-black/10 rounded-2xl p-5">
        <div className="text-sm font-semibold text-ink mb-3">Retention policy by plan</div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { plan:'Core',         retention:'90 days',  note:'Documents expire 90 days after signing unless extended' },
            { plan:'Connected',    retention:'3 years',  note:'Arizona standard for recreational liability documentation' },
            { plan:'Intelligence', retention:'7 years',  note:'Extended retention for litigation and compliance requirements' },
          ].map(({ plan, retention, note }) => (
            <div key={plan} className="bg-white rounded-xl border border-black/10 p-3">
              <div className="font-semibold text-ink mb-1">{plan}</div>
              <div className="text-brand font-mono font-medium mb-1">{retention}</div>
              <div className="text-gray-400 leading-relaxed">{note}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
