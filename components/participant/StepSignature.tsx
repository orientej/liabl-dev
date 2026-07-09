'use client'
import { useEffect, useRef, useState } from 'react'
interface Props { onSign:(dataUrl:string)=>void; onBack:()=>void; saving:boolean }
export default function StepSignature({ onSign, onBack, saving }: Props) {
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const drawing=useRef(false)
  const [hasSig,setHasSig]=useState(false)
  const [typedName,setTypedName]=useState('')
  const [rotated,setRotated]=useState(false)

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas)return
    const ctx=canvas.getContext('2d')!
    let isFirstSetup=true
    let resizeTimer:ReturnType<typeof setTimeout>|null=null

    // Resizing a canvas element (setting .width/.height) wipes its
    // contents AND resets all 2D context state — so this has to run
    // again, not just once at mount, any time the canvas's displayed
    // size actually changes (most commonly: a tablet rotating between
    // portrait and landscape at a physical check-in kiosk). Without
    // this, the canvas keeps its original internal resolution while its
    // displayed size changes, leaving touch coordinates mismatched with
    // where the stroke actually renders.
    function setupCanvas(){
      const c=canvasRef.current; if(!c)return
      c.width=c.offsetWidth*(window.devicePixelRatio||1)
      c.height=c.offsetHeight*(window.devicePixelRatio||1)
      ctx.scale(window.devicePixelRatio||1,window.devicePixelRatio||1)

      if(!isFirstSetup){
        // A signature already drawn (or in progress) at the old
        // resolution can't be safely rescaled without risking a
        // distorted or misaligned result for something legally
        // significant — clearer and safer to ask for a fresh signature
        // than to guess. setHasSig(false) already clears the canvas
        // visually since the resize above wipes it.
        setHasSig(false)
        setRotated(true)
      }
      isFirstSetup=false
    }

    setupCanvas()

    function handleResize(){
      if(resizeTimer)clearTimeout(resizeTimer)
      // Debounced — resize/orientationchange can fire several times in
      // quick succession while the browser settles into the new layout.
      resizeTimer=setTimeout(setupCanvas,150)
    }

    function pos(e:MouseEvent|TouchEvent){const r=canvas!.getBoundingClientRect(),src='touches'in e?e.touches[0]:e;return{x:src.clientX-r.left,y:src.clientY-r.top}}
    function start(e:MouseEvent|TouchEvent){drawing.current=true;const{x,y}=pos(e);ctx.beginPath();ctx.moveTo(x,y);setRotated(false)}
    function move(e:MouseEvent|TouchEvent){if(!drawing.current)return;e.preventDefault();const{x,y}=pos(e);ctx.lineTo(x,y);ctx.strokeStyle='#4B2ACF';ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();setHasSig(true)}
    function end(){drawing.current=false}
    canvas.addEventListener('mousedown',start);canvas.addEventListener('mousemove',move);canvas.addEventListener('mouseup',end);canvas.addEventListener('mouseleave',end)
    canvas.addEventListener('touchstart',start,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',end)
    window.addEventListener('resize',handleResize)
    window.addEventListener('orientationchange',handleResize)
    return()=>{
      canvas.removeEventListener('mousedown',start);canvas.removeEventListener('mousemove',move);canvas.removeEventListener('mouseup',end);canvas.removeEventListener('mouseleave',end)
      canvas.removeEventListener('touchstart',start);canvas.removeEventListener('touchmove',move);canvas.removeEventListener('touchend',end)
      window.removeEventListener('resize',handleResize)
      window.removeEventListener('orientationchange',handleResize)
      if(resizeTimer)clearTimeout(resizeTimer)
    }
  },[])
  function clear(){const c=canvasRef.current!;c.getContext('2d')!.clearRect(0,0,c.width,c.height);setHasSig(false);setRotated(false)}
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
      {rotated&&(
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-xs mb-3">
          Screen rotated — for a clean signature, please sign again below.
        </div>
      )}
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
