'use client'
import { useEffect, useRef, useState } from 'react'
interface Props { onSign:(dataUrl:string)=>void; onBack:()=>void; saving:boolean }
export default function StepSignature({ onSign, onBack, saving }: Props) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const drawing=useRef(false)
  const [hasSig,setHasSig]=useState(false)
  const [typedName,setTypedName]=useState('')
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return
    const ctx=canvas.getContext('2d')!
    canvas.width=canvas.offsetWidth*(window.devicePixelRatio||1); canvas.height=canvas.offsetHeight*(window.devicePixelRatio||1)
    ctx.scale(window.devicePixelRatio||1,window.devicePixelRatio||1)
    function pos(e:MouseEvent|TouchEvent){const r=canvas!.getBoundingClientRect(),src='touches'in e?e.touches[0]:e;return{x:src.clientX-r.left,y:src.clientY-r.top}}
    function start(e:MouseEvent|TouchEvent){drawing.current=true;const{x,y}=pos(e);ctx.beginPath();ctx.moveTo(x,y)}
    function move(e:MouseEvent|TouchEvent){if(!drawing.current)return;e.preventDefault();const{x,y}=pos(e);ctx.lineTo(x,y);ctx.strokeStyle='#4B2ACF';ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();setHasSig(true)}
    function end(){drawing.current=false}
    canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);canvas.addEventListener('mouseup',end);canvas.addEventListener('mouseleave',end)
    canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',end)
    return()=>{canvas.removeEventListener('mousedown',start);canvas.removeEventListener('mousemove',move);canvas.removeEventListener('mouseup',end);canvas.removeEventListener('mouseleave',end);canvas.removeEventListener('touchstart',start);canvas.removeEventListener('touchmove',move);canvas.removeEventListener('touchend',end)}
  },[])
  function clear(){const c=canvasRef.current!;c.getContext('2d')!.clearRect(0,0,c.width,c.height);setHasSig(false)}
  function submit(){
    if(typedName.trim()){const off=document.createElement('canvas');off.width=400;off.height=80;const ctx=off.getContext('2d')!;ctx.font='italic 36px Georgia,serif';ctx.fillStyle='#4B2ACF';ctx.fillText(typedName,20,55);onSign(off.toDataURL())}
    else if(hasSig){onSign(canvasRef.current!.toDataURL())}
  }
  const canSubmit=hasSig||typedName.trim().length>0
  const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
  return (
    <div className="card">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 5 of 5 · E-signature</p>
      <h2 className="font-serif text-2xl mb-1" style={{letterSpacing:'-0.01em'}}>Sign to confirm</h2>
      <p className="text-gray-500 text-sm mb-5">Draw your signature or type your full name below.</p>
      <div className="relative mb-1">
        <canvas ref={canvasRef} className="w-full h-20 rounded-xl border border-black/20 bg-surface cursor-crosshair block" style={{touchAction:'none'}}/>
        {!hasSig&&<p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">Draw your signature here</p>}
      </div>
      {hasSig&&<button onClick={clear} className="text-xs text-gray-400 hover:text-gray-600 underline mb-3">Clear</button>}
      <div className="my-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">Or type your full legal name</label>
        <input className="form-input" type="text" placeholder="Full name" value={typedName} onChange={e=>setTypedName(e.target.value)}/>
      </div>
      <div className="bg-brand/5 border border-brand/20 text-brand rounded-xl p-3 text-xs mb-5 flex gap-2">
        <span>🔒</span><span>Signing at {time} — IP recorded · ESIGN Act compliant</span>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} disabled={saving} className="btn-secondary">← Back</button>
        <button onClick={submit} disabled={!canSubmit||saving} className="btn-primary">{saving?'Saving…':'✓ Complete & submit'}</button>
      </div>
    </div>
  )
}
