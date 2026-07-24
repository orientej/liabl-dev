'use client'
import { useState } from 'react'
import { IconKayak, IconHike, IconATV, IconClimb, IconDocumentIntelligence } from '@/components/icons'

type Activity   = 'kayak'|'hike'|'atv'|'climb'|null
type Health     = 'none'|'cardiac'|'injury'|null
type Experience = 'none'|'beginner'|'intermediate'|'advanced'|null
type Minor      = 'adult'|'minor'|null

interface Clause { id:string; label:string; body:string; type:'base'|'activity'|'adaptive'|'guardian' }

const ACT_LABELS:Record<string,string>={kayak:'Whitewater Kayaking',hike:'Canyon Hiking',atv:'ATV Tour',climb:'Rock Climbing'}

function buildClauses(a:Activity,h:Health,e:Experience,m:Minor):Clause[]{
  if(!a)return[]
  const act=ACT_LABELS[a]
  const clauses:Clause[]=[
    {id:'base',type:'base',label:'Assumption of Risk',body:`Participant acknowledges the inherent risks of ${act} and voluntarily assumes full responsibility for any injuries or damages.`},
    {id:'release',type:'base',label:'Release of Liability',body:`Participant releases the operator from all liability arising from participation in ${act}, including acts of negligence.`},
    {id:'equipment',type:'base',label:'Equipment & Safety',body:'Participant confirms receipt of a full safety briefing and proper fitting of all required safety equipment.'},
    {id:'act',type:'activity',
      label:a==='kayak'?'Water Hazards':a==='hike'?'Terrain & Flash Flood':a==='atv'?'Motor Vehicle Operation':'Fall & Equipment Hazards',
      body:a==='kayak'?'Participant acknowledges Class III–IV rapids, submerged obstacles, and risk of capsize. Confirms they are a confident swimmer.'
          :a==='hike'?'Participant acknowledges uneven terrain, extreme temperatures, flash flood risk, and limited emergency access.'
          :a==='atv'?'Participant confirms they will comply with all speed limits and will not operate the vehicle under any substance.'
          :'Participant confirms they have received and understood the safety briefing for all anchor systems and harness equipment.'},
  ]
  if(h==='cardiac')clauses.push({id:'cardiac',type:'adaptive',label:'⚡ Physician Clearance — Cardiac',body:'Participant has disclosed a cardiovascular condition. Confirms written physician clearance within 30 days. Participation without valid clearance voids this waiver.'})
  if(h==='injury') clauses.push({id:'injury', type:'adaptive',label:'⚡ Recent Injury Disclosure',    body:'Participant has disclosed a recent injury or surgery. Confirms physician clearance for physical activity of this intensity.'})
  if(e==='none'&&(a==='kayak'||a==='climb'))clauses.push({id:'novice',type:'adaptive',label:'⚡ Novice Participant',body:`Participant has disclosed no prior experience with ${act}. Will follow all instructor guidance and attempt no unsupervised activity.`})
  if(m==='minor')clauses.push({id:'minor',type:'guardian',label:'⚡ Guardian Authorization Required',body:'Participant is under 18. A parent or legal guardian must co-sign this waiver.'})
  return clauses
}

const TYPE_STYLES:Record<string,string>={
  base:     'bg-surface border-black/10 text-gray-400',
  activity: 'bg-blue-50 border-blue-100 text-blue-600',
  adaptive: 'bg-brand/5 border-brand/20 text-brand',
  guardian: 'bg-amber-50 border-amber-200 text-amber-600',
}

export default function AdaptiveDemo() {
  const [activity,   setActivity]   = useState<Activity>(null)
  const [health,     setHealth]     = useState<Health>(null)
  const [experience, setExperience] = useState<Experience>(null)
  const [ageGroup,   setAgeGroup]   = useState<Minor>(null)

  const clauses       = buildClauses(activity,health,experience,ageGroup)
  const adaptiveCount = clauses.filter(c=>c.type==='adaptive'||c.type==='guardian').length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">1. Select activity</label>
          <div className="grid grid-cols-2 gap-2">
            {(['kayak','hike','atv','climb'] as Activity[]).map(a=>{
              const ICON_MAP = {kayak:IconKayak, hike:IconHike, atv:IconATV, climb:IconClimb}
              const LABEL_MAP = {kayak:'Kayaking', hike:'Hiking', atv:'ATV Tour', climb:'Climbing'}
              const Icon = ICON_MAP[a as keyof typeof ICON_MAP]
              return (
                <button key={a!} onClick={()=>setActivity(a)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all ${activity===a?'border-brand bg-brand/5 text-brand font-medium':'border-black/10 bg-surface text-gray-600 hover:border-brand/30'}`}>
                  <Icon size={16} color={activity===a?'#4B2ACF':'#6B7280'}/>
                  {LABEL_MAP[a as keyof typeof LABEL_MAP]}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">2. Health disclosure</label>
          <div className="space-y-2">
            {([{v:'none',l:'No known conditions'},{v:'cardiac',l:'Cardiac or respiratory condition'},{v:'injury',l:'Recent injury or surgery'}] as {v:Health;l:string}[]).map(({v,l})=>(
              <button key={v!} onClick={()=>setHealth(v)} className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border text-sm transition-all ${health===v?'border-brand bg-brand/5':'border-black/10 bg-surface hover:border-brand/30'}`}>
                <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${health===v?'border-brand bg-brand':'border-gray-300'}`}/>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">3. Experience level</label>
          <div className="grid grid-cols-2 gap-2">
            {(['none','beginner','intermediate','advanced'] as Experience[]).map(e=>(
              <button key={e!} onClick={()=>setExperience(e)} className={`p-2.5 rounded-xl border text-xs transition-all capitalize ${experience===e?'border-brand bg-brand/5 text-brand font-medium':'border-black/10 bg-surface text-gray-500 hover:border-brand/30'}`}>
                {e==='none'?'No experience':e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">4. Participant age</label>
          <div className="grid grid-cols-2 gap-2">
            {([{v:'adult',l:'Adult (18+)'},{v:'minor',l:'Minor (under 18)'}] as {v:Minor;l:string}[]).map(({v,l})=>(
              <button key={v!} onClick={()=>setAgeGroup(v)} className={`p-3 rounded-xl border text-sm transition-all ${ageGroup===v?'border-brand bg-brand/5 text-brand font-medium':'border-black/10 bg-surface text-gray-500 hover:border-brand/30'}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live document</label>
          {adaptiveCount>0&&<span className="text-xs bg-brand/10 text-brand border border-brand/20 px-2.5 py-1 rounded-full font-medium">⚡ {adaptiveCount} adaptive clause{adaptiveCount>1?'s':''}</span>}
        </div>
        {clauses.length===0?(
          <div className="bg-surface border border-black/10 rounded-2xl p-8 text-center min-h-64 flex flex-col items-center justify-center gap-2">
            <div className="mb-2 animate-pulse-soft flex justify-center"><IconDocumentIntelligence size={32} color="#9CA3AF"/></div>
            <div className="font-medium text-gray-500">Select an activity to generate the document</div>
            <div className="text-xs text-gray-400">Clauses update as you answer each question</div>
          </div>
        ):(
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {clauses.map((c,i)=>(
              <div key={c.id} className={`rounded-xl border p-3.5 animate-fade-up ${TYPE_STYLES[c.type]}`} style={{animationDelay:`${i*40}ms`}}>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1.5">{c.label}</div>
                <p className="text-xs leading-relaxed opacity-80">{c.body}</p>
              </div>
            ))}
            <div className="rounded-xl border border-black/10 bg-surface p-3 text-center">
              <div className="text-xs text-gray-400">{clauses.length} clause{clauses.length>1?'s':''} · {clauses.filter(c=>c.type==='base').length} standard · <span className="text-brand font-medium">{adaptiveCount} adaptive</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
