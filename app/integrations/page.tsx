'use client'
import { useState } from 'react'
import Logo         from '@/components/Logo'
import InsuranceTab    from '@/components/integrations/InsuranceTab'
import WhiteLabelTab  from '@/components/integrations/WhiteLabelTab'
import PageNav from '@/components/PageNav'

type Tab = 'platforms' | 'sso' | 'insurance' | 'webhooks' | 'apikeys' | 'eventlog' | 'whitelabel'

const PLATFORMS = [
  { id:'fareharbor',name:'FareHarbor',logo:'🟦',protocol:'Push + Webhook',connected:true,bookings:47,since:'Connected Mar 2026' },
  { id:'rezdy',name:'Rezdy',logo:'🟩',protocol:'Webhook',connected:true,bookings:12,since:'Connected Jan 2026' },
  { id:'xola',name:'Xola',logo:'🟧',protocol:'Push + Pull',connected:false,bookings:0,since:null },
  { id:'bokun',name:'Bókun',logo:'🟪',protocol:'Pull',connected:false,bookings:0,since:null },
]
const WEBHOOK_EVENTS = [
  { event:'group.created',dir:'out',desc:'Fires when a LIABL group is created from a platform booking.' },
  { event:'waiver.signed',dir:'out',desc:'Fires when a participant completes their waiver.' },
  { event:'waiver.overridden',dir:'out',desc:'Fires when a supervisor override is used.' },
  { event:'booking.confirmed',dir:'in',desc:'Platform sends this when a booking is confirmed.' },
  { event:'booking.updated',dir:'in',desc:'Participant added or removed from booking.' },
  { event:'booking.cancelled',dir:'in',desc:'Group marked inactive. Signed waivers remain as permanent legal records.' },
]
const EVENTS = [
  { time:'9:04 AM',event:'waiver.signed',platform:'FareHarbor',ref:'RKC-4821',participant:'Jordan Rivera',status:'delivered',ms:142 },
  { time:'8:55 AM',event:'group.created',platform:'FareHarbor',ref:'RKC-4821',participant:'—',status:'delivered',ms:201 },
  { time:'8:33 AM',event:'waiver.signed',platform:'Rezdy',ref:'RZ-0042',participant:'Tyler Brooks',status:'delivered',ms:155 },
  { time:'8:21 AM',event:'waiver.overridden',platform:'Rezdy',ref:'RZ-0042',participant:'Jamie Lee',status:'failed',ms:null },
]

function PlatformsTab() {
  const [expanded,setExpanded]=useState<string|null>('fareharbor')
  return (
    <div>
      <h2 className="font-serif text-xl mb-1" style={{letterSpacing:'-0.01em'}}>Platform integrations</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">Connect your booking platform so LIABL groups are created automatically when a booking is confirmed.</p>
      <div className="space-y-3">
        {PLATFORMS.map(p=>(
          <div key={p.id} className="bg-white rounded-2xl border border-black/10 overflow-hidden">
            <div onClick={()=>setExpanded(expanded===p.id?null:p.id)} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface/40">
              <span className="text-2xl">{p.logo}</span>
              <div className="flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-sm text-ink">{p.name}</span>{p.connected&&<span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Connected</span>}</div><div className="text-xs text-gray-400 mt-0.5">{p.connected?`${p.since} · ${p.bookings} bookings`:'Not connected'} · {p.protocol}</div></div>
              <span className="text-gray-400">{expanded===p.id?'▲':'▼'}</span>
            </div>
            {expanded===p.id&&(
              <div className="border-t border-black/8 px-5 py-4 bg-surface/30">
                {p.connected?(<div><div className="bg-ink rounded-xl p-4 font-mono text-xs text-green-400 mb-3 overflow-x-auto"><div className="text-gray-500 mb-1">{`// ${p.name} webhook payload`}</div><div>{`POST https://api.liabl.com/v1/groups`}</div><div className="mt-1 text-gray-300">{`{ "external_booking_id": "RKC-4821", "external_platform": "${p.id}" }`}</div></div><div className="flex gap-2"><button className="text-sm px-4 py-2 rounded-xl border border-black/20 text-gray-600 hover:bg-white">Configure</button><button className="text-sm px-4 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50">Disconnect</button></div></div>):(<div className="flex gap-2"><input className="form-input flex-1 font-mono text-xs" placeholder={`Paste ${p.name} API key…`}/><button className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 shrink-0">Connect</button></div>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SSOTab() {
  const [expanded,setExpanded]=useState<string|null>('azure')
  const [jit,setJit]=useState(true),[scim,setScim]=useState(true)
  const providers=[{id:'azure',name:'Azure Active Directory',logo:'🔷',protocol:'SAML 2.0 + OIDC',connected:true,since:'Feb 2026',users:14},{id:'okta',name:'Okta',logo:'🔵',protocol:'SAML 2.0 + OIDC',connected:false,since:null,users:0},{id:'google',name:'Google Workspace',logo:'🔴',protocol:'OIDC',connected:false,since:null,users:0}]
  return (
    <div className="space-y-6">
      <div><h2 className="font-serif text-xl mb-1" style={{letterSpacing:'-0.01em'}}>Identity & Single Sign-On</h2><p className="text-sm text-gray-500 max-w-2xl">Authenticate your team through Azure AD, Okta, or Google Workspace. LIABL supports SAML 2.0 and OIDC.</p></div>
      <div className="space-y-3">
        {providers.map(p=>(
          <div key={p.id} className="bg-white rounded-2xl border border-black/10 overflow-hidden">
            <div onClick={()=>setExpanded(expanded===p.id?null:p.id)} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface/40">
              <span className="text-2xl">{p.logo}</span>
              <div className="flex-1"><div className="flex items-center gap-2"><span className="font-semibold text-sm text-ink">{p.name}</span>{p.connected&&<span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Connected</span>}</div><div className="text-xs text-gray-400">{p.connected?`Connected ${p.since} · ${p.users} users`:'Not connected'} · {p.protocol}</div></div>
              <span className="text-gray-400">{expanded===p.id?'▲':'▼'}</span>
            </div>
            {expanded===p.id&&(
              <div className="border-t border-black/8 px-5 py-4 bg-surface/30">
                {p.connected?(<div className="grid grid-cols-2 gap-3"><div className="bg-white rounded-xl border border-black/8 p-3"><div className="text-xs text-gray-400 mb-1">Entity ID</div><div className="font-mono text-xs text-ink">https://auth.liabl.com/saml/azure</div></div><div className="bg-white rounded-xl border border-black/8 p-3"><div className="text-xs text-gray-400 mb-1">ACS URL</div><div className="font-mono text-xs text-ink">https://auth.liabl.com/saml/callback</div></div></div>):(<div className="flex gap-2"><input className="form-input flex-1 font-mono text-xs" placeholder={`https://your-${p.id}-domain.com/metadata`}/><button className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 shrink-0">Connect</button></div>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-black/10 p-5">
        <div className="font-semibold text-sm text-ink mb-3">SCIM user provisioning</div>
        <div className="mb-4"><input className="form-input font-mono text-sm" readOnly value="https://api.liabl.com/scim/v2"/></div>
        <div className="space-y-3">
          {[{l:'Just-in-time provisioning',s:'Create accounts on first SSO login',v:jit,set:setJit},{l:'SCIM auto-deprovisioning',s:'Revoke access when removed from IdP',v:scim,set:setScim}].map(({l,s,v,set})=>(<div key={l} className="flex items-center justify-between gap-4"><div><div className="text-sm font-medium text-ink">{l}</div><div className="text-xs text-gray-400">{s}</div></div><button onClick={()=>set(!v)} className={`w-11 h-6 rounded-full transition-all shrink-0 relative ${v?'bg-brand':'bg-gray-200'}`}><span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{left:v?'22px':'2px'}}/></button></div>))}
        </div>
      </div>
    </div>
  )
}

function WebhooksTab(){return(<div><h2 className="font-serif text-xl mb-4" style={{letterSpacing:'-0.01em'}}>Webhooks</h2><div className="bg-white rounded-2xl border border-black/10 overflow-hidden">{WEBHOOK_EVENTS.map((e,i)=>(<div key={i} className="flex items-start gap-4 px-5 py-3.5 border-b border-black/5 last:border-0"><span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${e.dir==='out'?'bg-brand/10 text-brand':'bg-emerald-50 text-emerald-600'}`}>{e.dir==='out'?'→ Out':'← In'}</span><div><div className="font-mono text-xs text-ink mb-0.5">{e.event}</div><div className="text-xs text-gray-400">{e.desc}</div></div></div>))}</div></div>)}
function ApiKeysTab(){return(<div><h2 className="font-serif text-xl mb-4" style={{letterSpacing:'-0.01em'}}>API keys</h2><div className="bg-ink rounded-2xl p-5"><div className="text-white font-medium mb-3 text-sm">Example</div><div className="font-mono text-xs text-green-400">{`curl -X POST https://api.liabl.com/v1/groups -H "Authorization: Bearer lbl_live_4k9...2mx"`}</div></div></div>)}
function EventLogTab(){return(<div><h2 className="font-serif text-xl mb-4" style={{letterSpacing:'-0.01em'}}>Event log</h2><div className="bg-white rounded-2xl border border-black/10 overflow-hidden">{EVENTS.map((e,i)=>(<div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-black/5 last:border-0 text-xs"><span className="font-mono text-gray-400 w-16 shrink-0">{e.time}</span><span className="font-mono text-ink flex-1">{e.event}</span><span className="text-gray-400">{e.platform}</span><span className="font-mono text-gray-400 mx-2">{e.ref}</span>{e.status==='delivered'?<span className="text-emerald-600 font-medium">✓ {e.ms}ms</span>:<span className="text-red-500 font-medium">✗ failed</span>}</div>))}</div></div>)}

export default function IntegrationsPage() {
  const [tab,setTab]=useState<Tab>('platforms')
  const tabs:[Tab,string][]=[['platforms','Platforms'],['sso','Identity & SSO'],['insurance','Insurance'],['webhooks','Webhooks'],['apikeys','API keys'],['eventlog','Event log'],['whitelabel','White-Label']]
  return (
    <div className="min-h-screen bg-surface">
      <PageNav badge="Integrations" />
      <div className="bg-white border-b border-black/10 px-5 overflow-x-auto">
        <div className="flex gap-0 max-w-3xl mx-auto min-w-max">
          {tabs.map(([key,label])=>(<button key={key} onClick={()=>setTab(key)} className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${tab===key?'border-brand text-brand':'border-transparent text-gray-500 hover:text-ink'}`}>{label}</button>))}
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {tab==='platforms'&&<PlatformsTab/>}
        {tab==='sso'&&<SSOTab/>}
        {tab==='insurance'&&<InsuranceTab/>}
        {tab==='webhooks'&&<WebhooksTab/>}
        {tab==='apikeys'&&<ApiKeysTab/>}
        {tab==='eventlog'&&<EventLogTab/>}
        {tab==='whitelabel'&&<WhiteLabelTab/>}
      </div>
    </div>
  )
}
