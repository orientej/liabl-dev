'use client'
import { useState } from 'react'
import Logo          from '@/components/Logo'
import SecurityTab   from '@/components/security/SecurityTab'
import EnterpriseTab from '@/components/security/EnterpriseTab'
import PageNav from '@/components/PageNav'

type Tab = 'security'|'enterprise'

const BANNERS: Record<Tab,{eyebrow:string;title:string;sub:string}> = {
  security:   { eyebrow:'Security & Audit',      title:'Tamper-evident. Legally defensible. Forensically complete.',                                              sub:'Every LIABL document is immutably hashed at signing time. Every event is logged with millisecond precision, IP address, device fingerprint, and chain of custody.' },
  enterprise: { eyebrow:'Enterprise features',   title:'Built for multi-location operators, resort groups, and school districts.',                               sub:'Role-based access control, metadata tagging, and automated lifecycle management give enterprise buyers the compliance and governance features their teams require.' },
}

export default function SecurityPage() {
  const [tab, setTab] = useState<Tab>('security')
  const b = BANNERS[tab]
  return (
    <div className="min-h-screen bg-surface">
      <PageNav badge="Security" />
      <div className="bg-white border-b border-black/10 px-5">
        <div className="flex gap-0 max-w-3xl mx-auto">
          {([['security','Security & Audit'],['enterprise','Enterprise Features']] as [Tab,string][]).map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${tab===key?'border-brand text-brand':'border-transparent text-gray-500 hover:text-ink'}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="bg-ink text-white px-5 py-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{color:'#A78BFA'}}>{b.eyebrow}</p>
          <h1 className="font-serif text-2xl sm:text-3xl mb-2" style={{letterSpacing:'-0.02em'}}>{b.title}</h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">{b.sub}</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {tab==='security'   && <SecurityTab/>}
        {tab==='enterprise' && <EnterpriseTab/>}
      </div>
    </div>
  )
}
