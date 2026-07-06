'use client'
import { useState } from 'react'

const AUDIT_EVENTS = [
  { time:'09:04:12.441', event:'waiver.signed',       actor:'Jordan Rivera',   detail:'SHA-256: 7f3a9c21... · IP: 98.112.44.21 · Chrome 124 / macOS' },
  { time:'09:04:11.028', event:'signature.captured',  actor:'Jordan Rivera',   detail:'Draw signature · Canvas fingerprint recorded' },
  { time:'09:03:58.774', event:'document.viewed',     actor:'Jordan Rivera',   detail:'All 6 clauses scrolled · Average read time: 47 seconds' },
  { time:'09:03:44.102', event:'waiver.generated',    actor:'LIABL system',    detail:'Activity: Kayaking · 2 adaptive clauses · Risk score: 42 (Moderate)' },
  { time:'09:03:40.021', event:'session.started',     actor:'Jordan Rivera',   detail:'Entry via operator QR code · Session AM-04' },
  { time:'09:02:15.330', event:'session.qr_generated',actor:'LIABL system',    detail:'QR code issued for AM-04 Whitewater Kayaking' },
]

const EVENT_COLORS: Record<string, string> = {
  'waiver.signed':       'bg-emerald-50 text-emerald-700',
  'signature.captured':  'bg-emerald-50 text-emerald-700',
  'document.viewed':     'bg-brand/10 text-brand',
  'waiver.generated':    'bg-blue-50 text-blue-700',
  'session.started':     'bg-gray-100 text-gray-600',
  'session.qr_generated':'bg-gray-100 text-gray-600',
}

export default function SecurityTab() {
  const [docId,     setDocId]     = useState('')
  const [verified,  setVerified]  = useState<boolean|null>(null)
  const [verifying, setVerifying] = useState(false)

  function verify() {
    if (!docId.trim()) return
    setVerifying(true)
    setTimeout(() => {
      setVerified(docId.includes('a1b2') ? true : Math.random() > 0.2)
      setVerifying(false)
    }, 1200)
  }

  return (
    <div className="space-y-10">

      {/* Document integrity */}
      <div>
        <h2 className="font-serif text-xl mb-1" style={{ letterSpacing:'-0.01em' }}>Document integrity verification</h2>
        <p className="text-sm text-gray-500 mb-4 max-w-2xl leading-relaxed">
          Every signed LIABL document receives a SHA-256 cryptographic hash at the moment of signing.
          Paste any Document ID to retrieve the chain of custody and verify the document has not been altered.
        </p>
        <div className="bg-white rounded-2xl border border-black/10 p-5">
          <div className="flex gap-3 mb-4">
            <input className="form-input flex-1 font-mono text-sm" placeholder="doc_a1b2c3d4…" value={docId} onChange={e=>{ setDocId(e.target.value); setVerified(null) }} onKeyDown={e=>e.key==='Enter'&&verify()}/>
            <button onClick={verify} disabled={!docId.trim()||verifying} className="px-5 py-2.5 bg-brand text-white rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-40 transition-all shrink-0">
              {verifying ? '⟳ Verifying…' : 'Verify'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">Try <span onClick={()=>setDocId('doc_a1b2c3d4')} className="text-brand underline cursor-pointer font-mono">doc_a1b2c3d4</span> to see a verified result.</p>

          {verified !== null && (
            <div className={`rounded-xl border p-4 animate-fade-up ${verified ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className={`font-semibold text-sm mb-2 ${verified ? 'text-emerald-700' : 'text-red-700'}`}>
                {verified ? '✓ Document integrity verified' : '✗ Document not found or integrity compromised'}
              </div>
              {verified && (
                <div className="space-y-1.5 text-xs">
                  {[
                    { l:'Document ID',   v:docId },
                    { l:'Participant',   v:'Jordan Rivera' },
                    { l:'Activity',      v:'Whitewater Kayaking' },
                    { l:'Signed at',     v:'Jun 3, 2026 · 9:04 AM' },
                    { l:'SHA-256 hash',  v:'7f3a9c212d4e...9b01f4' },
                    { l:'IP address',    v:'98.112.44.21' },
                    { l:'Device',        v:'Chrome 124 / macOS 14.4' },
                    { l:'Legal hold',    v:'None' },
                    { l:'Status',        v:'✓ Unmodified' },
                  ].map(({ l, v }) => (
                    <div key={l} className="flex gap-3">
                      <span className="text-gray-400 w-28 shrink-0">{l}</span>
                      <span className="font-mono text-emerald-800 font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Audit trail */}
      <div>
        <h2 className="font-serif text-xl mb-1" style={{ letterSpacing:'-0.01em' }}>Real-time audit trail</h2>
        <p className="text-sm text-gray-500 mb-4 max-w-2xl leading-relaxed">
          Every event in the LIABL document lifecycle is logged with millisecond precision, IP address, device fingerprint,
          and actor identity. This is the chain of custody your legal team produces in court.
        </p>
        <div className="bg-white rounded-2xl border border-black/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-black/8 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Event stream · doc_a1b2c3d4</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">✓ Chain intact</span>
          </div>
          <div className="divide-y divide-black/5">
            {AUDIT_EVENTS.map((e, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <span className="font-mono text-gray-400 text-xs shrink-0 w-24 mt-0.5">{e.time}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${EVENT_COLORS[e.event] ?? 'bg-gray-100 text-gray-600'}`}>{e.event}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-ink">{e.actor}</div>
                  <div className="text-xs text-gray-400 leading-relaxed mt-0.5">{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hash explanation */}
      <div className="bg-ink rounded-2xl p-6">
        <h3 className="font-serif text-xl text-white mb-2" style={{ letterSpacing:'-0.01em' }}>How document sealing works</h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-5">
          When a participant submits their signature, LIABL concatenates the document content, participant identity,
          timestamp, IP address, and session metadata — then generates a SHA-256 hash of the result.
          That hash is stored immutably. If a single character in the document changes, the hash changes.
        </p>
        <div className="bg-white/10 rounded-xl p-4 font-mono text-xs text-green-400 overflow-x-auto">
          <div className="text-gray-500 mb-2">{`// Document sealing pseudocode`}</div>
          <div>{`const payload = {`}</div>
          <div className="ml-4 text-gray-300">{`clauses:    document.clauses,`}</div>
          <div className="ml-4 text-gray-300">{`participant: identity.verified,`}</div>
          <div className="ml-4 text-gray-300">{`signature:  canvas.toDataURL(),`}</div>
          <div className="ml-4 text-gray-300">{`timestamp:  Date.now(),`}</div>
          <div className="ml-4 text-gray-300">{`ip_address: req.headers['x-forwarded-for'],`}</div>
          <div className="ml-4 text-gray-300">{`session_id: session.id,`}</div>
          <div>{`}`}</div>
          <div className="mt-2">{`const hash = SHA256(JSON.stringify(payload))`}</div>
          <div className="mt-1 text-green-300">{`// → 7f3a9c212d4e5b6a8c9d0e1f2a3b4c5d...`}</div>
        </div>
      </div>

    </div>
  )
}
