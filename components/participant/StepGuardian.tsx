'use client'
import { useEffect, useRef, useState } from 'react'

interface GuardianProps { minorName:string; onNext:(v:{guardianName:string;guardianSig:string})=>void; onBack:()=>void }
export function StepGuardian({ minorName, onNext, onBack }: GuardianProps) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const drawing=useRef(false)
  const [guardian,setGuardian]=useState(''),[relation,setRelation]=useState('Parent'),[hasSig,setHasSig]=useState(false)
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return
    const ctx=canvas.getContext('2d')!
    canvas.width=canvas.offsetWidth*(window.devicePixelRatio||1); canvas.height=canvas.offsetHeight*(window.devicePixelRatio||1)
    ctx.scale(window.devicePixelRatio||1,window.devicePixelRatio||1)
    function pos(e:MouseEvent|TouchEvent){const r=canvas!.getBoundingClientRect(),src='touches'in e?e.touches[0]:e;return{x:src.clientX-r.left,y:src.clientY-r.top}}
    function start(e:MouseEvent|TouchEvent){drawing.current=true;const{x,y}=pos(e);ctx.beginPath();ctx.moveTo(x,y)}
    function move(e:MouseEvent|TouchEvent){if(!drawing.current)return;e.preventDefault();const{x,y}=pos(e);ctx.lineTo(x,y);ctx.strokeStyle='#4B2ACF';ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();setHasSig(true)}
    function end(){drawing.current=false}
    canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);canvas.addEventListener('mouseup',end);canvas.addEventListener('mouseleave',end)
    canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',end)
    return()=>{canvas.removeEventListener('mousedown',start);canvas.removeEventListener('mousemove',move);canvas.removeEventListener('mouseup',end);canvas.removeEventListener('mouseleave',end);canvas.removeEventListener('touchstart',start);canvas.removeEventListener('touchmove',move);canvas.removeEventListener('touchend',end)}
  },[])
  function clear(){const c=canvasRef.current!;c.getContext('2d')!.clearRect(0,0,c.width,c.height);setHasSig(false)}
  function submit(){if(!guardian.trim()||!hasSig)return;onNext({guardianName:`${guardian} (${relation})`,guardianSig:canvasRef.current!.toDataURL()})}
  return (
    <div className="card">
      <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-sm flex gap-2 mb-5"><span>⚠️</span><span><strong>{minorName}</strong> is a minor. A parent or legal guardian must sign.</span></div>
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Guardian authorization</p>
      <h2 className="font-serif text-2xl mb-5" style={{letterSpacing:'-0.01em'}}>Guardian signature required</h2>
      <div className="space-y-4 mb-5">
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Guardian full name</label><input className="form-input" value={guardian} onChange={e=>setGuardian(e.target.value)} placeholder="First Last"/></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Relationship</label><select className="form-input" value={relation} onChange={e=>setRelation(e.target.value)}><option>Parent</option><option>Legal guardian</option><option>Grandparent</option><option>Other authorized adult</option></select></div>
      </div>
      <div className="relative mb-1"><canvas ref={canvasRef} className="w-full h-20 rounded-xl border border-black/20 bg-surface cursor-crosshair block" style={{touchAction:'none'}}/>{!hasSig&&<p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">Guardian — draw signature here</p>}</div>
      {hasSig&&<button onClick={clear} className="text-xs text-gray-400 hover:text-gray-600 underline mb-3">Clear</button>}
      <div className="flex gap-3 mt-4"><button onClick={onBack} className="btn-secondary">← Back</button><button onClick={submit} disabled={!guardian.trim()||!hasSig} className="btn-primary">Submit guardian signature →</button></div>
    </div>
  )
}
