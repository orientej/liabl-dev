'use client'
import { useState } from 'react'
import Logo from '@/components/Logo'
import PageNav from '@/components/PageNav'
import { DEMO_GROUPS, Group, GroupTab } from '@/lib/groups'

const STATUS_STYLES: Record<string,string> = {
  complete:    'bg-emerald-50 text-emerald-700',
  in_progress: 'bg-brand/10 text-brand',
  exceptions:  'bg-amber-50 text-amber-700',
}
const STATUS_LABELS: Record<string,string> = { complete:'Complete', in_progress:'In progress', exceptions:'Exceptions' }
const SOURCE_LABELS: Record<string,string> = { fareharbor:'FareHarbor', rezdy:'Rezdy', xola:'Xola', manual:'Manual' }

function AllGroupsTab({ groups, onSelect }: { groups:Group[]; onSelect:(g:Group)=>void }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="font-serif text-2xl" style={{letterSpacing:'-0.01em'}}>Group reservations</h1><p className="text-sm text-gray-400 mt-1">{groups.length} active groups today</p></div>
        <button className="text-sm px-4 py-2 bg-brand text-white rounded-xl font-medium hover:opacity-90">+ New group</button>
      </div>
      <div className="space-y-3">
        {groups.map(g=>(
          <div key={g.id} onClick={()=>onSelect(g)} className="bg-white rounded-2xl border border-black/10 p-5 hover:border-brand/30 hover:shadow-sm cursor-pointer transition-all">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{g.emoji}</span>
                <div><div className="font-semibold text-ink">{g.name}</div><div className="text-xs text-gray-400">{g.activity} · {g.date}</div></div>
              </div>
              <div className="flex items-center gap-2">
                {g.bookingRef&&<span className="font-mono text-xs text-gray-400">{SOURCE_LABELS[g.source]}: {g.bookingRef}</span>}
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[g.status]}`}>{STATUS_LABELS[g.status]}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-black/8 rounded-full overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all" style={{width:`${Math.round(g.signed/g.total*100)}%`}}/>
              </div>
              <span className="text-xs text-gray-500 shrink-0">{g.signed}/{g.total} signed</span>
              {g.exceptions>0&&<span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{g.exceptions} exception{g.exceptions>1?'s':''}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RosterTab({ group }: { group:Group }) {
  const members=[
    {name:'Jordan Rivera',  status:'signed',   activity:group.activity,time:'8:42 AM',pass:true},
    {name:'Mia Chen',       status:'guardian', activity:group.activity,time:'8:51 AM',pass:false},
    {name:'Tyler Brooks',   status:'signed',   activity:group.activity,time:'8:53 AM',pass:false},
    {name:'Sasha Kim',      status:'pending',  activity:group.activity,time:'—',       pass:false},
    {name:'Omar Hassan',    status:'signed',   activity:group.activity,time:'8:58 AM',pass:true},
  ].slice(0, group.signed + Math.min(group.total-group.signed, 2))
  const BG=['#E6F1FB','#E1F5EE','#EEE9FF','#FAEEDA','#FBEAF0']
  const FG=['#185FA5','#0F6E56','#4B2ACF','#854F0B','#993556']
  return (
    <div>
      <h2 className="font-serif text-xl mb-4" style={{letterSpacing:'-0.01em'}}>{group.name} · Roster</h2>
      <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
        {members.map((m,i)=>(
          <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-black/5 last:border-0">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{background:BG[i%5],color:FG[i%5]}}>{m.name.split(' ').map(n=>n[0]).join('')}</div>
            <div className="flex-1"><div className="text-sm font-medium text-ink flex items-center gap-1">{m.name}{m.pass&&<span className="text-brand text-xs ml-1">✦</span>}</div><div className="text-xs text-gray-400">{m.activity} · {m.time}</div></div>
            {m.status==='signed'  ?<span className="status-signed">Signed</span>
            :m.status==='guardian'?<span className="status-guardian">Guardian</span>
            :<span className="status-pending">Pending</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ExceptionsTab({ group }: { group:Group }) {
  const exceptions=[
    {name:'Mia Chen',  type:'guardian_required', desc:'Participant is 16 — guardian signature required before activity', resolved:false},
    {name:'Sam Torres',type:'health_flag',        desc:'Cardiovascular condition disclosed — physician clearance clause added', resolved:false},
  ].slice(0, Math.max(group.exceptions, 1))
  return (
    <div>
      <h2 className="font-serif text-xl mb-4" style={{letterSpacing:'-0.01em'}}>{group.name} · Exceptions</h2>
      {group.exceptions===0?(
        <div className="bg-white rounded-2xl border border-black/10 p-8 text-center"><div className="text-3xl mb-3">✅</div><div className="font-medium text-ink">No exceptions</div><div className="text-sm text-gray-400 mt-1">All participants cleared</div></div>
      ):(
        <div className="space-y-3">
          {exceptions.map((e,i)=>(
            <div key={i} className={`bg-white rounded-2xl border p-5 ${e.resolved?'border-emerald-200':'border-amber-200'}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-semibold text-ink">{e.name}</div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${e.resolved?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{e.resolved?'Resolved':e.type==='guardian_required'?'Guardian required':'Health flag'}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">{e.desc}</p>
              {!e.resolved&&<button className="text-sm px-4 py-2 bg-brand text-white rounded-xl font-medium hover:opacity-90">Mark as resolved</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateGroupTab() {
  const [name,setName]=useState(''),[activity,setActivity]=useState('kayak'),[source,setSource]=useState('manual'),[saved,setSaved]=useState(false)
  function create(){if(!name.trim())return;setSaved(true);setTimeout(()=>{setSaved(false);setName('')},2000)}
  return (
    <div>
      <h2 className="font-serif text-xl mb-1" style={{letterSpacing:'-0.01em'}}>Create group reservation</h2>
      <p className="text-sm text-gray-400 mb-6">Set up a group manually or sync from your booking platform.</p>
      {saved?(
        <div className="card text-center"><div className="text-3xl mb-3">✅</div><div className="font-medium text-ink">Group created</div><div className="text-sm text-gray-400 mt-1">Signing invitations sent to all participants</div></div>
      ):(
        <div className="card space-y-4">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Group name</label><input className="form-input" placeholder="e.g. Smith Family Reunion" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Activity</label><select className="form-input" value={activity} onChange={e=>setActivity(e.target.value)}><option value="kayak">Whitewater Kayaking</option><option value="hike">Canyon Hiking</option><option value="atv">ATV Tour</option><option value="climb">Rock Climbing</option></select></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Session date & time</label><input className="form-input" type="datetime-local"/></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Source</label><div className="grid grid-cols-2 gap-2">{[{v:'manual',l:'Manual'},{v:'fareharbor',l:'FareHarbor'},{v:'rezdy',l:'Rezdy'},{v:'xola',l:'Xola'}].map(({v,l})=>(<button key={v} onClick={()=>setSource(v)} className={`py-2 rounded-xl text-sm font-medium border transition-all ${source===v?'bg-brand text-white border-brand':'border-black/10 bg-surface text-gray-500'}`}>{l}</button>))}</div></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Participant emails (one per line)</label><textarea className="form-input resize-none" rows={4} placeholder="participant@email.com&#10;another@email.com"/></div>
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-3 text-xs text-brand">Pre-arrival signing links will be sent automatically. Participants complete waivers before arrival.</div>
          <button onClick={create} disabled={!name.trim()} className="btn-primary">Create group & send invitations →</button>
        </div>
      )}
    </div>
  )
}

export default function GroupsPage() {
  const [tab,setTab]=useState<GroupTab>('all')
  const [selectedGroup,setSelectedGroup]=useState<Group|null>(null)
  const groups=DEMO_GROUPS

  function selectGroup(g:Group){setSelectedGroup(g);setTab('roster')}

  return (
    <div className="min-h-screen bg-surface">
      <PageNav badge="Groups" operatorName="Desert Ridge Adventures" operatorAccent="#4B2ACF" />
      <div className="bg-white border-b border-black/10 px-5 overflow-x-auto">
        <div className="flex gap-0 max-w-2xl mx-auto min-w-max">
          {([['all','All groups'],['roster','Roster'],['exceptions','Exceptions'],['create','+ Create']] as [GroupTab,string][]).map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab===key?'border-brand text-brand':'border-transparent text-gray-500 hover:text-ink'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {tab==='all'        && <AllGroupsTab groups={groups} onSelect={selectGroup}/>}
        {tab==='roster'     && <RosterTab    group={selectedGroup??groups[0]}/>}
        {tab==='exceptions' && <ExceptionsTab group={selectedGroup??groups[1]}/>}
        {tab==='create'     && <CreateGroupTab/>}
      </div>
    </div>
  )
}
