'use client'
import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/Logo'
import PageNav from '@/components/PageNav'
import { Users, Building2, Puzzle, ChevronRight, ChevronLeft, ExternalLink, type LucideIcon } from 'lucide-react'
import { IconCreditCard, IconNetwork, IconRiskBadge, IconTrending } from '@/components/icons'

type Persona = 'operator' | 'enterprise' | 'platform'

interface DemoStep {
  title:     string
  narrative: string
  link?:     string
  linkLabel?: string
  highlight: string
}

const PERSONAS: Record<Persona, {
  icon:     LucideIcon
  label:    string
  role:     string
  pain:     string
  duration: string
  color:    string
  bg:       string
  steps:    DemoStep[]
  close:    string
}> = {
  operator: {
    icon:     Users,
    label:    'Activity Operator',
    role:     'Owner or ops manager · Adventure, fitness, or wellness',
    pain:     'Check-in takes too long, guardian paperwork is a mess, and when something goes wrong they can\'t find the waiver.',
    duration: '8 min demo',
    color:    '#4B2ACF',
    bg:       'bg-brand/5 border-brand/20',
    steps: [
      { title:'The signing flow', narrative:'A participant scans a QR code at your venue and completes their waiver in under 2 minutes — fully adaptive to their activity and health profile. No clipboard, no PDF.', link:'/participant', linkLabel:'Open participant flow →', highlight:'Notice how the waiver changes based on health answers — that\'s the adaptive document engine.' },
      { title:'Instant roster update', narrative:'The moment they sign, they appear in your operator dashboard. No manual entry, no spreadsheet sync. You see signed, pending, and exceptions at a glance.', link:'/operator', linkLabel:'Open operator dashboard →', highlight:'Click any signed participant row to see the full waiver detail, audit trail, and staff note field.' },
      { title:'Guardian flow for minors', narrative:'When a participant\'s DOB indicates they\'re under 18, the flow automatically adds a guardian signature step — a separate legal clause and a separate e-signature. No paper forms.', link:'/participant', linkLabel:'Try the waiver flow →', highlight:'Enter a date of birth under 18 in the identity step to trigger the guardian path.' },
      { title:'Group reservations', narrative:'Before the session, pre-invite your group via email link. Participants sign before they arrive. You start with a complete manifest instead of a clipboard.', link:'/groups', linkLabel:'Open group reservations →', highlight:'The Exceptions tab shows guardian flags and blockers in real time — filtered from all personal health detail.' },
      { title:'Booking platform sync', narrative:'Connect FareHarbor, Rezdy, or Xola. When a booking is confirmed, LIABL creates the group and sends invites automatically. Waiver status flows back to FareHarbor — your manifest is always in sync.', link:'/integrations', linkLabel:'Open integrations →', highlight:'Expand the FareHarbor card to see the exact API call and the bidirectional webhook setup.' },
      { title:'When something goes wrong', narrative:'File an incident report in 30 seconds. LIABL applies a legal hold to the waiver, logs the full chain of custody, and notifies your insurance carrier automatically.', link:'/operator', linkLabel:'Open incident reports →', highlight:'The incident report fires a webhook to your carrier immediately — no phone calls, no faxed forms.' },
      { title:'The risk score', narrative:'Every participant gets an AI risk score based on their activity, age, health disclosures, and experience level. Operators see it at check-in. High-risk participants get flagged before the session starts.', link:'/operator', linkLabel:'View roster with risk scores →', highlight:'Risk scores are also shared with connected insurance carriers to inform underwriting.' },
    ],
    close: 'You\'re spending 15+ minutes per group on check-in admin. At 3 groups a day, that\'s 45 minutes. LIABL gives you that time back on day one — for $149/month.',
  },

  enterprise: {
    icon:     Building2,
    label:    'Enterprise Operator',
    role:     'VP Operations · Resort group, franchise, or school district',
    pain:     'No consistency across locations, can\'t pull a waiver in an incident, IT requires SSO, legal requires audit trails.',
    duration: '12 min demo',
    color:    '#DC2626',
    bg:       'bg-red-50 border-red-200',
    steps: [
      { title:'Legal defensibility', narrative:'Every signed document receives a SHA-256 cryptographic hash at signing time. Any tampering — even a single character — invalidates the hash. Your legal team can produce a complete chain of custody in seconds.', link:'/security', linkLabel:'Open security & audit →', highlight:'Click any event in the audit trail to see the full forensic detail: IP, device, timestamp to the millisecond, document hash.' },
      { title:'Document integrity verification', narrative:'Paste any Document ID to retrieve its full chain of custody — creation, views, signing event, IP, hash, and current integrity status. This is what you hand to opposing counsel.', link:'/security', linkLabel:'Try document verification →', highlight:'Use doc_a1b2c3d4 as a test ID to see the full chain of custody returned.' },
      { title:'Incident reporting & legal hold', narrative:'When an incident occurs, staff file a report in the app. LIABL automatically applies a legal hold — preventing the document from expiring — and notifies your carrier. The document is frozen until you release the hold.', link:'/operator', linkLabel:'Open incident reports →', highlight:'The retention policy engine enforces legal hold status automatically. Documents cannot be deleted while a hold is active.' },
      { title:'Role-based access control', narrative:'Three permission tiers: Owner, Manager, and Staff. Health disclosures and waiver content are never visible to Staff — only actionable status. Your legal team controls what check-in staff can see.', link:'/security', linkLabel:'Open enterprise features →', highlight:'Click each role in the RBAC panel to see exactly which of 14 permissions it enables or disables.' },
      { title:'SSO & user provisioning', narrative:'Authenticate your team through Azure AD or Okta. New staff get LIABL accounts automatically on first sign-in. When someone leaves, access is revoked within minutes — no manual offboarding.', link:'/integrations', linkLabel:'Open SSO setup →', highlight:'The SCIM provisioning log shows every user.provisioned and user.deprovisioned event in real time.' },
      { title:'Insurance integration', narrative:'LIABL shares your anonymized risk and compliance data directly with your carrier at renewal time. Incident reports fire automatic webhooks to your carrier\'s claims intake. No faxed forms, no phone calls.', link:'/integrations', linkLabel:'Open insurance integrations →', highlight:'The underwriting export lets you configure exactly which data fields your carrier receives.' },
      { title:'Analytics across all locations', narrative:'Signing completion rates, exception trends, age distribution, and activity breakdown — exportable as CSV or PDF for any date range. The data your operations and risk teams have always asked for.', link:'/operator', linkLabel:'Open analytics →', highlight:'The completion funnel shows exactly where participants abandon the waiver flow — and how to fix it.' },
    ],
    close: 'Your legal team needs chain of custody. Your IT team needs SSO. Your operations team needs real-time visibility across all locations. This is the only waiver platform that gives you all three.',
  },

  platform: {
    icon:     Puzzle,
    label:    'Booking Platform Partner',
    role:     'Product or partnerships · FareHarbor, Mindbody, Vagaro',
    pain:     'Operators keep asking for waiver features. Building it is expensive. A white-label partnership is faster and stickier.',
    duration: '10 min demo',
    color:    '#059669',
    bg:       'bg-emerald-50 border-emerald-200',
    steps: [
      { title:'White-label in 60 seconds', narrative:'LIABL adapts completely to any operator\'s brand. Toggle between the two operators on the home page to see how the signing experience, color palette, icon, and operator name all change.', link:'/', linkLabel:'See white-label toggle →', highlight:'Every participant-facing screen inherits the operator\'s brand. The LIABL mark appears only as "Secured by LIABL" in the footer.' },
      { title:'The API integration', narrative:'One API call from your platform creates a LIABL group, sends waiver invites to all participants, and returns a per-participant signing URL and a QR code — all in under 200ms.', link:'/integrations', linkLabel:'See API documentation →', highlight:'Expand the FareHarbor card to see the exact POST /v1/groups payload and the response structure.' },
      { title:'Bidirectional status sync', narrative:'When a participant signs their waiver, LIABL fires a waiver.signed webhook back to your platform. Your manifest shows waiver status without operators switching tabs.', link:'/integrations', linkLabel:'See webhook events →', highlight:'The event log shows every outbound webhook with delivery status, latency, and retry history.' },
      { title:'The participant identity graph', narrative:'Every participant who signs through any LIABL-powered operator builds a verified profile. When they book with a different operator on your platform, LIABL recognizes them — 15-second re-sign instead of 2 minutes.', link:'/portal', linkLabel:'See LIABL Pass →', highlight:'The LIABL Pass header shows cross-operator recognition. This is the network effect that compounds with every operator you onboard.' },
      { title:'Insurance connectivity', narrative:'LIABL connects operators directly to their insurance carriers. Incident data flows from the operator\'s waiver system to the carrier\'s claims intake automatically. For your platform, this means stickier operator relationships.', link:'/integrations', linkLabel:'See insurance integrations →', highlight:'The incident notification log shows how LIABL becomes the connective tissue between operators and their insurers.' },
      { title:'Revenue model', narrative:'White-label licensing is priced as a platform fee rather than per-operator. One integration surfaces LIABL to every operator on your platform at their moment of highest relevance — when a booking is confirmed.', link:'/pricing', linkLabel:'See white-label pricing →', highlight:'The white-label CTA at the bottom of the pricing page outlines the partnership model. Revenue share is available for high-volume platform partners.' },
    ],
    close: 'One integration. Every operator on your platform gets a best-in-class waiver experience under their own brand. You retain the relationship — LIABL handles the compliance.',
  },
}

export default function DemoPage() {
  const [persona,  setPersona]  = useState<Persona | null>(null)
  const [step,     setStep]     = useState(0)
  const [complete, setComplete] = useState(false)

  function selectPersona(p: Persona) { setPersona(p); setStep(0); setComplete(false) }
  function next() {
    if (!persona) return
    if (step < PERSONAS[persona].steps.length - 1) setStep(s => s + 1)
    else setComplete(true)
  }
  function prev() { setStep(s => Math.max(0, s - 1)) }
  function restart() { setPersona(null); setStep(0); setComplete(false) }

  const p = persona ? PERSONAS[persona] : null
  const currentStep = p ? p.steps[step] : null

  return (
    <div className="min-h-screen bg-surface">
      <nav className="bg-white border-b border-black/10 px-5 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/" className="hover:opacity-90 transition-opacity"><Logo size="md" /></Link>
        <div className="flex items-center gap-3">
          {persona && (
            <button onClick={restart} className="text-xs text-gray-400 hover:text-ink transition-colors">← Choose persona</button>
          )}
          <span className="text-xs bg-surface border border-black/10 px-3 py-1.5 rounded-full text-gray-500">
            Sales demo
          </span>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-black/15 text-gray-600 hover:bg-surface hover:text-ink transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11 L12 3 L21 11"/>
              <path d="M5 10 L5 20 C5 20.5 5.5 21 6 21 L18 21 C18.5 21 19 20.5 19 20 L19 10"/>
              <path d="M10 21 L10 14 L14 14 L14 21"/>
            </svg>
            <span className="hidden sm:inline">Home</span>
          </Link>
        </div>
      </nav>

      {/* Persona selector */}
      {!persona && (
        <div className="max-w-3xl mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-3">Sales demo</p>
            <h1 className="font-serif text-3xl sm:text-4xl text-ink mb-4" style={{ letterSpacing:'-0.02em' }}>
              Who are you presenting to?
            </h1>
            <p className="text-gray-500 text-base max-w-lg mx-auto leading-relaxed">
              Select a buyer persona to launch a guided, scripted walkthrough tailored to their specific pain points and decision criteria.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(Object.entries(PERSONAS) as [Persona, typeof PERSONAS[Persona]][]).map(([key, val]) => (
              <button key={key} onClick={() => selectPersona(key)}
                className="text-left bg-white rounded-2xl border border-black/10 p-6 hover:border-brand/30 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform" style={{ background:val.color }}>
                  <val.icon size={18} strokeWidth={1.75} style={{ color:'white' }} />
                </div>
                <div className="font-semibold text-ink mb-1">{val.label}</div>
                <div className="text-xs text-gray-400 mb-3 leading-snug">{val.role}</div>
                <div className="text-xs text-gray-400 mb-4 leading-relaxed">
                  <strong className="text-gray-600">Their pain:</strong> {val.pain}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs bg-surface border border-black/10 px-2.5 py-1 rounded-full text-gray-500">{val.duration}</span>
                  <ChevronRight size={14} className="text-gray-400 group-hover:text-brand transition-colors" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-xs text-gray-400 mb-3">Or explore the full prototype directly</p>
            <Link href="/" className="text-sm text-brand underline hover:opacity-70 transition-opacity">
              Back to home →
            </Link>
          </div>
        </div>
      )}

      {/* Demo flow */}
      {persona && p && currentStep && !complete && (
        <div className="max-w-3xl mx-auto px-4 py-10">
          {/* Persona header */}
          <div className={`rounded-2xl border p-4 mb-8 flex items-center gap-4 ${p.bg}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background:p.color }}>
              <p.icon size={18} strokeWidth={1.75} style={{ color:'white' }} />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-sm text-ink">{p.label}</div>
              <div className="text-xs text-gray-500">{p.role}</div>
            </div>
            <div className="text-xs text-gray-400">{p.duration}</div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {p.steps.map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-brand' : 'bg-black/10'}`} />
            ))}
            <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
              {step + 1} of {p.steps.length}
            </span>
          </div>

          {/* Step content */}
          <div className="animate-fade-up" key={step}>
            <div className="card mb-4">
              <div className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">
                Step {step + 1}
              </div>
              <h2 className="font-serif text-2xl text-ink mb-3" style={{ letterSpacing:'-0.01em' }}>
                {currentStep.title}
              </h2>
              <p className="text-gray-600 leading-relaxed mb-5">{currentStep.narrative}</p>

              {/* Highlight callout */}
              <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 mb-5 flex gap-3 items-start">
                <IconRiskBadge size={20} color="#4B2ACF" className="shrink-0 mt-0.5"/>
                <div>
                  <div className="text-xs font-semibold text-brand mb-1">What to point out</div>
                  <p className="text-sm text-brand/80 leading-relaxed">{currentStep.highlight}</p>
                </div>
              </div>

              {/* CTA to live section */}
              {currentStep.link && (
                <Link href={currentStep.link}
                  className="inline-flex items-center gap-2 text-sm text-brand border border-brand/30 bg-brand/5 px-4 py-2.5 rounded-xl hover:bg-brand/10 transition-colors font-medium">
                  <ExternalLink size={14} />
                  {currentStep.linkLabel}
                </Link>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              {step > 0 && (
                <button onClick={prev} className="btn-secondary flex items-center gap-2 py-3 px-5">
                  <ChevronLeft size={14} /> Previous
                </button>
              )}
              <button onClick={next} className="btn-primary flex items-center justify-center gap-2">
                {step < p.steps.length - 1 ? <>Next step <ChevronRight size={14} /></> : 'Finish demo ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion screen */}
      {persona && p && complete && (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl" style={{ background: p.color + '20' }}>
            ✓
          </div>
          <h2 className="font-serif text-3xl text-ink mb-4" style={{ letterSpacing:'-0.02em' }}>Demo complete.</h2>

          {/* Close line */}
          <div className="bg-ink rounded-2xl p-6 mb-8 text-left">
            <div className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color:'#A78BFA' }}>The close</div>
            <p className="text-white text-lg leading-relaxed font-serif" style={{ letterSpacing:'-0.01em' }}>
              &ldquo;{p.close}&rdquo;
            </p>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <Link href="/pricing" className="card hover:shadow-md transition-shadow text-center py-4">
              <div className="flex justify-center mb-2"><IconCreditCard size={24} color="#4B2ACF"/></div>
              <div className="font-semibold text-ink text-sm">Show pricing</div>
              <div className="text-xs text-gray-400">Plans from $49/mo</div>
            </Link>
            <Link href="/why" className="card hover:shadow-md transition-shadow text-center py-4">
              <div className="flex justify-center mb-2"><IconTrending size={24} color="#15803D"/></div>
              <div className="font-semibold text-ink text-sm">Investor overview</div>
              <div className="text-xs text-gray-400">Market thesis & demos</div>
            </Link>
            <Link href="/" className="card hover:shadow-md transition-shadow text-center py-4">
              <div className="flex justify-center mb-2"><IconNetwork size={24} color="#EA580C"/></div>
              <div className="font-semibold text-ink text-sm">Full prototype</div>
              <div className="text-xs text-gray-400">Explore all features</div>
            </Link>
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={restart} className="btn-secondary">← Choose different persona</button>
            <button onClick={() => { setStep(0); setComplete(false) }}
              className="btn-primary max-w-xs">↺ Replay this demo</button>
          </div>
        </div>
      )}
    </div>
  )
}
