'use client'
import { useState } from 'react'
import { IconKayak, IconHike, IconATV, IconClimb, IconDocumentIntelligence } from '@/components/icons'

interface Question { id:string; text:string; type:'yes_no'|'text'|'multiple'; triggers_clause?:boolean }
interface Template { id:string; name:string; activityKey:string; questions:Question[]; published:boolean }

const ACTIVITY_ICON: Record<string, React.ComponentType<{size?:number;color?:string}>> = {
  kayak: IconKayak,
  hike:  IconHike,
  atv:   IconATV,
  climb: IconClimb,
}
const ACTIVITY_COLOR: Record<string, string> = {
  kayak:'#4B2ACF', hike:'#15803D', atv:'#EA580C', climb:'#0891B2',
}

const TEMPLATES_INITIAL: Template[] = [
  {id:'t1',name:'Whitewater Kayaking',activityKey:'kayak',published:true,questions:[{id:'q1',text:'Are you a confident swimmer?',type:'yes_no',triggers_clause:true},{id:'q2',text:'Do you have prior kayaking experience?',type:'multiple'},{id:'q3',text:'Any cardiovascular or respiratory conditions?',type:'yes_no',triggers_clause:true}]},
  {id:'t2',name:'Canyon Hiking',activityKey:'hike',published:true,questions:[{id:'q1',text:'Any recent lower-body injuries?',type:'yes_no',triggers_clause:true},{id:'q2',text:'Comfortable hiking in extreme heat?',type:'yes_no'}]},
  {id:'t3',name:'ATV Tour',activityKey:'atv',published:false,questions:[{id:'q1',text:"Do you hold a valid driver's license?",type:'yes_no',triggers_clause:true},{id:'q2',text:'Any seizure or vision conditions?',type:'yes_no',triggers_clause:true}]},
]

export default function TemplateTab() {
  const [templates] = useState<Template[]>(TEMPLATES_INITIAL)
  const [selected, setSelected] = useState<string>('t1')
  const current = templates.find(t => t.id === selected)

  return (
    <div>
      <h1 className="font-serif text-2xl mb-1" style={{letterSpacing:'-0.01em'}}>Activity Template Builder</h1>
      <p className="text-sm text-gray-400 mb-6">Configure adaptive question sets. Questions marked with ⚡ trigger additional waiver clauses based on the answer.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {templates.map(t => {
          const Icon = ACTIVITY_ICON[t.activityKey] ?? IconDocumentIntelligence
          const color = ACTIVITY_COLOR[t.activityKey] ?? '#4B2ACF'
          return (
            <button key={t.id} onClick={() => setSelected(t.id)} className={`text-center p-4 rounded-xl border transition-all ${selected === t.id ? 'border-brand bg-brand/5' : 'bg-white border-black/10 hover:border-brand/30'}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 mx-auto" style={{background:color}}>
                <Icon size={20} color="#FFFFFF"/>
              </div>
              <div className="text-xs font-semibold text-ink leading-snug">{t.name}</div>
              <div className="mt-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.published?'bg-success-light text-success-deep':'bg-amber-50 text-amber-700'}`}>{t.published?'Live':'Draft'}</span></div>
            </button>
          )
        })}
      </div>

      {current && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = ACTIVITY_ICON[current.activityKey] ?? IconDocumentIntelligence
                const color = ACTIVITY_COLOR[current.activityKey] ?? '#4B2ACF'
                return (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:color}}>
                    <Icon size={20} color="#FFFFFF"/>
                  </div>
                )
              })()}
              <div>
                <div className="font-semibold text-ink">{current.name}</div>
                <div className="text-xs text-gray-400">{current.questions.length} questions · {current.questions.filter(q => q.triggers_clause).length} trigger adaptive clauses</div>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${current.published?'bg-success-light text-success-deep':'bg-amber-50 text-amber-700'}`}>{current.published ? 'Published' : 'Draft'}</span>
          </div>

          <div className="space-y-2 mb-4">
            {current.questions.map((q, i) => (
              <div key={q.id} className="bg-surface rounded-xl border border-black/8 p-3 flex items-start gap-3">
                <span className="text-xs text-gray-400 font-mono shrink-0 mt-0.5">{(i+1).toString().padStart(2,'0')}</span>
                <div className="flex-1">
                  <div className="text-sm text-ink">{q.text}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Type: {q.type === 'yes_no' ? 'Yes/No' : q.type === 'multiple' ? 'Multiple choice' : 'Free text'}</div>
                </div>
                {q.triggers_clause && (
                  <span className="text-xs bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-full font-medium shrink-0">⚡ Adaptive</span>
                )}
              </div>
            ))}
          </div>

          <div className="bg-brand/5 border border-brand/20 rounded-xl p-4">
            <div className="text-xs font-semibold text-brand uppercase tracking-wider mb-1">Adaptive document logic</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              When a participant answers a triggered question with the high-risk option, LIABL automatically generates and inserts the corresponding clause into their waiver — physician clearance for cardiac conditions, recent-injury disclosure, equipment-specific consent, and so on. The document is unique to each participant.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
