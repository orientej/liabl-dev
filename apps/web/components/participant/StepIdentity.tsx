'use client'
import { useState } from 'react'

interface Props {
  onNext: (v:{ fullName:string; dob:string; email:string; isMinor:boolean; phone?:string; marketingEmailConsent?:boolean; marketingSmsConsent?:boolean })=>void
  onBack: ()=>void
  // Configurable age of majority (defaults to 18). A participant younger than
  // this is treated as a minor and the guardian step is required.
  ageOfMajority?: number
  // Marketing (M1): show the optional phone + marketing opt-in when the
  // operator has marketing enabled. Off by default.
  marketingEnabled?: boolean
  operatorName?: string
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAYS   = Array.from({length:31}, (_,i) => i+1)
const YEARS  = Array.from({length:100}, (_,i) => new Date().getFullYear() - i)

export default function StepIdentity({ onNext, onBack, ageOfMajority = 18, marketingEnabled = false, operatorName }: Props) {
  const majority = ageOfMajority > 0 ? ageOfMajority : 18
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [month,     setMonth]     = useState('')
  const [day,       setDay]       = useState('')
  const [year,      setYear]      = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [smsOptIn,   setSmsOptIn]   = useState(false)

  // Compute age from selected dropdowns
  function getAge(): number | null {
    if (!month || !day || !year) return null
    const m = MONTHS.indexOf(month) // 0-indexed
    if (m < 0) return null
    const birth = new Date(Number(year), m, Number(day))
    if (isNaN(birth.getTime())) return null
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const mo = today.getMonth() - birth.getMonth()
    if (mo < 0 || (mo === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const age     = getAge()
  const isMinor = age !== null && age < majority
  const dobFilled = !!month && !!day && !!year
  // v23 M1 fix #4 — output ISO 8601 date format (YYYY-MM-DD) so Supabase
  // can store it in a real `date` column instead of `text`. Previously
  // this produced "January 5, 1985" which forced text storage and made
  // age math fragile across timezones and locales.
  const monthIndex = MONTHS.indexOf(month) // 0-indexed
  const dob = dobFilled && monthIndex >= 0
    ? `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
    : ''
  const valid   = firstName.trim().length > 0 && lastName.trim().length > 0 && dobFilled && email.includes('@')

  function submit() {
    if (!valid) return
    onNext({
      fullName:`${firstName.trim()} ${lastName.trim()}`, dob, email, isMinor: isMinor ?? false,
      phone: marketingEnabled ? (phone.trim() || undefined) : undefined,
      marketingEmailConsent: marketingEnabled ? emailOptIn : undefined,
      marketingSmsConsent: marketingEnabled ? (smsOptIn && !!phone.trim()) : undefined,
    })
  }

  return (
    <div className="card">
      <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Step 1 of 5</p>
      <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing:'-0.01em' }}>Who&apos;s Signing Today?</h2>
      <p className="text-gray-500 text-sm mb-6">Enter your details as they appear on your ID.</p>

      <div className="space-y-4">
        {/* First Name + Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">First Name</label>
            <input className="form-input" value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="First Name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
            <input className="form-input" value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Last Name" />
          </div>
        </div>

        {/* Date of Birth — three fixed dropdowns */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Date of Birth</label>
          <div className="grid grid-cols-3 gap-2">
            {/* Month */}
            <select className="form-input" value={month} onChange={e=>setMonth(e.target.value)}>
              <option value="">Month</option>
              {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            {/* Day */}
            <select className="form-input" value={day} onChange={e=>setDay(e.target.value)}>
              <option value="">Day</option>
              {DAYS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            {/* Year */}
            <select className="form-input" value={year} onChange={e=>setYear(e.target.value)}>
              <option value="">Year</option>
              {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {age !== null && (
            <p className="text-xs text-gray-400 mt-1">Age: {age}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email Address</label>
          <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" />
        </div>

        {/* Marketing (optional) — only when the operator has marketing on */}
        {marketingEnabled && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mobile phone <span className="text-gray-400">(optional)</span></label>
              <input className="form-input" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="rounded-xl border border-black/10 bg-surface p-3 space-y-2">
              <div className="text-xs text-gray-500">Stay in touch with {operatorName || 'us'} (optional — separate from your waiver confirmation):</div>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" className="mt-0.5" checked={emailOptIn} onChange={e=>setEmailOptIn(e.target.checked)} />
                <span>Email me offers and updates</span>
              </label>
              <label className={`flex items-start gap-2 text-sm ${phone.trim() ? 'text-ink' : 'text-gray-400'}`}>
                <input type="checkbox" className="mt-0.5" checked={smsOptIn} disabled={!phone.trim()} onChange={e=>setSmsOptIn(e.target.checked)} />
                <span>Text me offers and updates{!phone.trim() && ' (add a phone number first)'}. Msg &amp; data rates may apply; reply STOP to opt out.</span>
              </label>
            </div>
          </>
        )}
      </div>

      {isMinor && (
        <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-sm">
          ⚠️ Participant is under {majority} — a guardian signature will be required.
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button onClick={onBack} className="btn-secondary">← Back</button>
        <button onClick={submit} disabled={!valid} className="btn-primary">Continue →</button>
      </div>
    </div>
  )
}
