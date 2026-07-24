'use client'
import { useState } from 'react'
import { QrCode, UserCheck, ClipboardList, Shield, CheckCircle, ChevronRight, ArrowLeft, WifiOff, Wifi, Smartphone, type LucideIcon } from 'lucide-react'
import { IconAuditTrail, IconRiskProfile, IconMobile } from '@/components/icons'

type Screen = 'home'|'scan'|'recognized'|'activity'|'health'|'document'|'signature'|'confirm'|'manifest'

function Phone({ children, isOffline }: { children:React.ReactNode; isOffline:boolean }) {
  return (
    <div className="relative mx-auto" style={{ width:280 }}>
      <div className="bg-ink rounded-[2.5rem] p-2 shadow-2xl">
        <div className="bg-white rounded-[2rem] overflow-hidden" style={{ minHeight:520 }}>
          <div className={`flex items-center justify-between px-5 py-2 text-xs ${isOffline?'bg-amber-500 text-white':'bg-white text-gray-500'}`}>
            <span className="font-medium">9:41</span>
            <div className="flex items-center gap-1">{isOffline?<><WifiOff size={12}/><span className="font-medium">Offline</span></>:<><Wifi size={12}/><span>●●●</span></>}</div>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

const SCREENS: { key:Screen; label:string; icon:LucideIcon }[] = [
  { key:'home',       label:'App home',      icon:Smartphone  },
  { key:'scan',       label:'Scan QR',       icon:QrCode      },
  { key:'recognized', label:'Pass recognized',icon:UserCheck  },
  { key:'activity',   label:'Select activity',icon:ClipboardList },
  { key:'document',   label:'Review waiver', icon:Shield      },
  { key:'signature',  label:'Sign',          icon:CheckCircle },
  { key:'confirm',    label:'Confirmed',     icon:CheckCircle },
  { key:'manifest',   label:'Manifest',      icon:ClipboardList },
]

function HomeScreen({ onScreen, isOffline }: { onScreen:(s:Screen)=>void; isOffline:boolean }) {
  return (
    <div className="flex flex-col bg-surface h-full">
      <div className="bg-white px-4 py-3 border-b border-black/8 flex items-center justify-between">
        <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center"><span className="text-white text-xs font-bold">L</span></div><span className="font-serif font-semibold text-sm text-ink">LIABL</span></div>
        <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center text-xs font-semibold text-brand">JT</div>
      </div>
      <div className="flex-1 px-4 py-4 space-y-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Desert Ridge Adventures</div>
        <div className="bg-white rounded-2xl border border-black/10 p-4">
          <div className="text-xs text-gray-400 mb-1">Today · AM-04 · 9:00 AM</div>
          <div className="font-semibold text-ink text-sm mb-3">Whitewater Kayaking</div>
          <div className="flex gap-2 mb-3">
            {[{v:'7',l:'Signed',c:'text-emerald-600'},{v:'2',l:'Pending',c:'text-amber-600'},{v:'9',l:'Total',c:'text-ink'}].map(({v,l,c})=>(<div key={l} className="flex-1 bg-surface rounded-xl p-2 text-center"><div className={`font-semibold text-base ${c}`}>{v}</div><div className="text-xs text-gray-400">{l}</div></div>))}
          </div>
          <button onClick={()=>onScreen('manifest')} className="w-full py-2 bg-brand text-white rounded-xl text-xs font-semibold">View manifest →</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={()=>onScreen('scan')} className="bg-white rounded-2xl border border-black/10 p-4 text-left hover:border-brand/30"><QrCode size={20} className="text-brand mb-2"/><div className="text-xs font-semibold text-ink">Scan QR</div><div className="text-xs text-gray-400">Check in participant</div></button>
          <button onClick={()=>onScreen('recognized')} className="bg-white rounded-2xl border border-black/10 p-4 text-left hover:border-brand/30"><UserCheck size={20} className="text-emerald-600 mb-2"/><div className="text-xs font-semibold text-ink">Verify pass</div><div className="text-xs text-gray-400">LIABL Pass scan</div></button>
        </div>
        {isOffline&&<div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><WifiOff size={14} className="text-amber-600 shrink-0 mt-0.5"/><div className="text-xs text-amber-700"><div className="font-semibold mb-0.5">Offline mode</div><div>2 signatures queued — will sync when connected</div></div></div>}
      </div>
    </div>
  )
}

function WaiverStep({ screen, onScreen }: { screen:Screen; onScreen:(s:Screen)=>void }) {
  const steps:[Screen,string,string,Screen][]=[
    ['activity','Step 1','Select activity','health'],
    ['health','Step 2','Health disclosure','document'],
    ['document','Step 3','Review waiver','signature'],
    ['signature','Step 4','Sign','confirm'],
  ]
  const current=steps.find(s=>s[0]===screen)
  if(!current)return null
  const [,stepNum,title,next]=current
  return (
    <div className="flex flex-col bg-surface h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-black/8">
        <button onClick={()=>onScreen('home')}><ArrowLeft size={18} className="text-ink"/></button>
        <div><div className="text-ink font-semibold text-sm">{title}</div><div className="text-xs text-gray-400">{stepNum} of 4</div></div>
      </div>
      <div className="flex gap-1 px-4 pt-3">{steps.map(([k],i)=><div key={k} className={`flex-1 h-1 rounded-full ${steps.findIndex(s=>s[0]===screen)>=i?'bg-brand':'bg-black/10'}`}/>)}</div>
      <div className="flex-1 px-4 py-4">
        {screen==='activity'&&<div className="space-y-2">{[['🚣','Kayaking'],['🥾','Hiking'],['🏎️','ATV'],['🧗','Climbing']].map(([e,l])=>(<div key={l} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-black/8"><span className="text-lg">{e}</span><span className="text-xs font-semibold text-ink flex-1">{l}</span><ChevronRight size={12} className="text-gray-300"/></div>))}</div>}
        {screen==='health'&&<div className="space-y-2"><p className="text-xs text-gray-500 mb-3">Any cardiovascular conditions or injuries?</p>{['No known conditions','Yes — cardiac/respiratory','Yes — recent injury'].map(o=>(<div key={o} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-black/8"><div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0"/><span className="text-xs text-ink">{o}</span></div>))}</div>}
        {screen==='document'&&<div className="space-y-2"><div className="bg-brand/5 border border-brand/20 rounded-xl p-3"><div className="text-xs font-semibold text-brand mb-1">⚡ Activity-specific clause</div><p className="text-xs text-gray-600 leading-relaxed">Participant acknowledges Class III–IV rapids and risk of capsize.</p></div><div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2"><span className="text-xs font-semibold text-amber-700">⚡ Risk score: Elevated (58)</span></div><div className="bg-surface border border-black/8 rounded-xl p-3"><div className="text-xs font-semibold text-gray-400 mb-1">Assumption of Risk</div><p className="text-xs text-gray-500 leading-relaxed">Participant acknowledges inherent risks…</p></div></div>}
        {screen==='signature'&&<div className="space-y-3"><div className="bg-surface border border-black/20 rounded-xl h-20 flex items-center justify-center"><p className="text-xs text-gray-400">Draw signature here</p></div><div className="bg-brand/5 border border-brand/20 rounded-xl p-2 flex gap-2 text-xs text-brand"><Shield size={12} className="shrink-0 mt-0.5"/><span>ESIGN Act · IP recorded</span></div></div>}
      </div>
      <div className="px-4 pb-6"><button onClick={()=>onScreen(next)} className="w-full py-3 bg-brand text-white rounded-xl text-sm font-semibold">{next==='confirm'?'✓ Sign & submit':'Continue →'}</button></div>
    </div>
  )
}

function RecognizedScreen({ onScreen }: { onScreen:(s:Screen)=>void }) {
  return (
    <div className="flex flex-col bg-surface h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-black/8"><button onClick={()=>onScreen('home')}><ArrowLeft size={18} className="text-ink"/></button><span className="text-ink font-semibold text-sm">LIABL Pass recognized</span></div>
      <div className="flex-1 px-4 py-4">
        <div className="bg-brand rounded-2xl p-4 text-white mb-4">
          <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-semibold text-sm">JR</div><div><div className="font-semibold text-sm">Jordan Rivera</div><div className="text-white/60 text-xs">✦ LIABL Pass · LP-4821</div></div><div className="ml-auto bg-emerald-400 text-white text-xs px-2 py-0.5 rounded-full font-semibold">Signed</div></div>
          <div className="grid grid-cols-3 gap-2 text-center">{[{v:'7',l:'Visits'},{v:'3',l:'Operators'},{v:'Jun 3',l:'Last'}].map(({v,l})=>(<div key={l} className="bg-white/10 rounded-xl py-2"><div className="font-semibold text-sm">{v}</div><div className="text-white/60 text-xs">{l}</div></div>))}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2 mb-4"><CheckCircle size={16} className="text-emerald-600 shrink-0"/><span className="text-emerald-700 text-xs font-medium">Waiver valid · Cleared to participate</span></div>
        <button onClick={()=>onScreen('home')} className="w-full py-2.5 bg-brand text-white rounded-xl text-sm font-semibold">Check in ✓</button>
      </div>
    </div>
  )
}

function ConfirmScreen({ onScreen }: { onScreen:(s:Screen)=>void }) {
  return (
    <div className="flex flex-col items-center justify-center bg-surface h-full px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4"><CheckCircle size={28} className="text-emerald-500"/></div>
      <h3 className="font-serif text-xl text-ink mb-2">Signed!</h3>
      <p className="text-sm text-gray-500 mb-4">Waiver recorded. Copy sent to your email.</p>
      <div className="flex flex-wrap gap-2 justify-center mb-4">{['9:04 AM','Kayaking','ESIGN ✓','⚡ Elevated'].map(t=>(<span key={t} className="bg-white border border-black/10 text-xs px-2.5 py-1 rounded-full text-gray-500">{t}</span>))}</div>
      <button onClick={()=>onScreen('home')} className="w-full py-2.5 bg-brand text-white rounded-xl text-sm font-semibold">← Back to manifest</button>
    </div>
  )
}

function ManifestScreen({ onScreen }: { onScreen:(s:Screen)=>void }) {
  const participants=[{name:'Jordan Rivera',status:'signed',time:'8:42 AM',pass:true},{name:'Mia Chen',status:'guardian',time:'8:51 AM',pass:false},{name:'Tyler Brooks',status:'signed',time:'8:53 AM',pass:false},{name:'Sasha Kim',status:'pending',time:'—',pass:false},{name:'Omar Hassan',status:'signed',time:'8:58 AM',pass:true}]
  return (
    <div className="flex flex-col bg-surface h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-black/8"><button onClick={()=>onScreen('home')}><ArrowLeft size={18} className="text-ink"/></button><div><div className="text-ink font-semibold text-sm">Session manifest</div><div className="text-xs text-gray-400">AM-04 · Kayaking</div></div></div>
      <div className="flex-1 overflow-y-auto">
        {participants.map((p,i)=>(<div key={i} className="flex items-center gap-2 px-4 py-3 border-b border-black/5 bg-white"><div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center text-xs font-semibold text-brand shrink-0">{p.name.split(' ').map((n:string)=>n[0]).join('')}</div><div className="flex-1"><div className="text-xs font-medium text-ink">{p.name}{p.pass&&<span className="text-brand text-xs ml-1">✦</span>}</div><div className="text-xs text-gray-400">{p.time}</div></div><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status==='signed'?'bg-emerald-50 text-emerald-700':p.status==='guardian'?'bg-violet-50 text-violet-700':'bg-amber-50 text-amber-700'}`}>{p.status==='signed'?'Signed':p.status==='guardian'?'Guardian':'Pending'}</span></div>))}
      </div>
      <div className="px-4 py-3 border-t border-black/8 bg-white"><button onClick={()=>onScreen('scan')} className="w-full py-2.5 bg-brand text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"><QrCode size={16}/>Scan next participant</button></div>
    </div>
  )
}

function ScanScreen({ onScreen }: { onScreen:(s:Screen)=>void }) {
  const [scanned,setScanned]=useState(false)
  return (
    <div className="flex flex-col bg-ink h-full">
      <div className="flex items-center gap-3 px-4 py-3"><button onClick={()=>onScreen('home')}><ArrowLeft size={18} className="text-white"/></button><span className="text-white font-semibold text-sm">Scan QR code</span></div>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative w-44 h-44 mb-6">
          <div className="absolute inset-0 border-2 border-white/20 rounded-2xl"/>
          {scanned?<div className="absolute inset-0 flex items-center justify-center"><CheckCircle size={48} className="text-emerald-400"/></div>:<div className="absolute inset-0 flex items-center justify-center"><QrCode size={48} className="text-white/30"/></div>}
          {!scanned&&<div className="absolute left-2 right-2 h-0.5 bg-violet-400/60 top-1/2 animate-pulse-soft"/>}
        </div>
        <p className="text-white/60 text-xs text-center mb-6">Point camera at participant&apos;s QR code or LIABL Pass</p>
        <button onClick={()=>{setScanned(true);setTimeout(()=>onScreen('recognized'),800)}} className="bg-violet-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">{scanned?'Recognized…':'Simulate scan'}</button>
      </div>
    </div>
  )
}

export default function MobileTab() {
  const [screen,setScreen]=useState<Screen>('home')
  const [isOffline,setIsOffline]=useState(false)
  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div><h1 className="font-serif text-2xl" style={{letterSpacing:'-0.01em'}}>LIABL mobile app</h1><p className="text-sm text-gray-400 mt-1">iOS & Android · Interactive wireframes</p></div>
        <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Offline mode:</span><button onClick={()=>setIsOffline(!isOffline)} className={`w-11 h-6 rounded-full transition-all relative ${isOffline?'bg-amber-500':'bg-gray-200'}`}><span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{left:isOffline?'22px':'2px'}}/></button></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col items-center">
          <Phone isOffline={isOffline}>
            {screen==='home'       &&<HomeScreen onScreen={setScreen} isOffline={isOffline}/>}
            {screen==='scan'       &&<ScanScreen onScreen={setScreen}/>}
            {screen==='recognized' &&<RecognizedScreen onScreen={setScreen}/>}
            {(screen==='activity'||screen==='health'||screen==='document'||screen==='signature')&&<WaiverStep screen={screen} onScreen={setScreen}/>}
            {screen==='confirm'    &&<ConfirmScreen onScreen={setScreen}/>}
            {screen==='manifest'   &&<ManifestScreen onScreen={setScreen}/>}
          </Phone>
          <div className="flex flex-wrap gap-2 mt-5 justify-center max-w-xs">
            {SCREENS.map(({key,label,icon:Icon})=>(<button key={key} onClick={()=>setScreen(key)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${screen===key?'bg-brand text-white':'bg-white border border-black/10 text-gray-500 hover:border-brand/30'}`}><Icon size={11}/>{label}</button>))}
          </div>
        </div>
        <div className="space-y-4">
          {/* Deep-link flow */}
          <div className="bg-ink rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-1 flex items-center gap-2 text-sm">🔗 Deep-Link Flow</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              A FareHarbor booking confirmation email contains a <span className="font-mono text-green-400">liabl://</span> deep link
              that opens directly to the pre-populated signing flow — zero friction for participants.
            </p>
            <div className="space-y-3 mb-4">
              {[
                {n:'1',Icon:IconAuditTrail, l:'Booking confirmed',    d:'FareHarbor sends booking confirmation email to participant'},
                {n:'2',Icon:IconRiskProfile, l:'Tap link in email',    d:'Email contains "Complete your waiver" button with liabl://session/RKC-4821'},
                {n:'3',Icon:IconMobile,     l:'App opens to flow',    d:'LIABL app opens directly — activity, operator, and session pre-loaded'},
                {n:'4',glyph:'✦', l:'Pass recognized',      d:'Returning participant — profile pre-filled. Signed in ~15 seconds'},
                {n:'5',glyph:'⚡',l:'Status back to FareHarbor',d:'waiver.signed webhook fires within 200ms. Manifest updated automatically'},
              ].map((row)=>(
                <div key={row.n} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">{row.n}</div>
                  <div>
                    <div className="text-white text-xs font-semibold inline-flex items-center gap-1.5">
                      {'glyph' in row ? <span>{row.glyph}</span> : <row.Icon size={12} color="#FFFFFF"/>}
                      {row.l}
                    </div>
                    <div className="text-gray-400 text-xs leading-relaxed">{row.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white/10 rounded-xl p-3 font-mono text-xs text-green-400">
              <div className="text-gray-500 mb-1">{`// Deep link format`}</div>
              <div>liabl://session/<span className="text-violet-300">RKC-4821</span></div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-black/10 p-5">
            <h3 className="font-semibold text-ink mb-3 flex items-center gap-2"><Smartphone size={16} className="text-brand"/>App Overview</h3>
            <div className="space-y-2.5 text-sm">
              {[{l:'Participant signing',d:'Full 4-step waiver flow — activity selection, health disclosure, adaptive document review, and e-signature.'},{l:'QR / code entry',d:'Participants scan a QR code or enter a 6-digit session code. LIABL resolves it to the operator and template instantly.'},{l:'LIABL Pass fast-sign',d:'Returning participants scan their Pass QR. Profile pre-fills. Signed in ~15 seconds.'},{l:'Staff manifest view',d:'Live session roster with signed/pending status and risk score badges. Tap any participant to view their waiver.'},{l:'Scan to verify',d:'Point camera at participant\'s Pass QR. Shows name, waiver status, and any flags in one tap.'}].map(({l,d})=>(<div key={l} className="flex gap-3"><span className="text-brand mt-0.5 shrink-0">✓</span><div><span className="font-medium text-ink">{l} — </span><span className="text-gray-500">{d}</span></div></div>))}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="font-semibold text-ink mb-3 flex items-center gap-2"><WifiOff size={16} className="text-amber-600"/>Offline mode</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">Toggle offline above to see how the app behaves with no connectivity — critical for river guides and backcountry tours.</p>
            <div className="space-y-1.5">
              {['Waiver templates cached before the session','Participants complete full signing flow offline','Signatures stored in encrypted local SQLite database','Documents sync automatically when connectivity resumes','Staff manifest shows ⚠ pending sync indicator'].map(f=>(<div key={f} className="flex gap-2 text-xs text-amber-800"><span className="text-amber-500 shrink-0">✓</span>{f}</div>))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
