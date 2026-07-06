'use client'
import { IconLegalHold, IconAuditTrail, IconRiskProfile, IconNetwork, IconDocumentIntelligence, IconLIABLPass, IconIntegration } from '@/components/icons'

const TIMELINE = [
  {
    year:'2000', era:'The eSign Act',
    headline:'Digital signatures become legally equivalent to ink — defensible in court worldwide.',
    bullets:[
      'Passed in U.S. and majority of countries simultaneously',
      'Created the legal framework for the digital document economy',
      'Activity operators gain a legal path off paper for the first time',
    ],
    accent:false,
  },
  {
    year:'2000s', era:'The first wave',
    headline:'Horizontal platforms capture the signature — for any industry, any document type.',
    bullets:[
      'DocuSign, EchoSign dominate the enterprise market',
      'Built for contracts — not risk-specific operator documents',
      'Breadth over depth; industry-specific needs unmet',
    ],
    accent:false,
  },
  {
    year:'2013', era:'The vertical market',
    headline:'Waiver-specific platforms emerge. The high-risk industry goes fully digital.',
    bullets:[
      'Smartwaiver, Wherewolf, others serve activity operators',
      'Paper-to-digital transition: adventure, fitness, wellness',
      'Category matures — and hits a ceiling of signature capture only',
    ],
    accent:false,
  },
  {
    year:'2026', era:'The intelligence gap',
    headline:'Digital is universal. The real need is now document intelligence and integration.',
    bullets:[
      'Every operator has a waiver tool — none have smart documents',
      'Operators managing complexity platforms weren\'t built for',
      'No platform addresses participant identity or data compounding',
    ],
    accent:true,
  },
]

const CEILINGS = [
  { title:"Documents that don't know what they're covering",
    body:"A skydiving waiver and a yoga class waiver look identical on every platform in the market. Activity type, risk profile, and jurisdiction drive nothing. Operators configure everything manually — and most don't know what they're missing." },
  { title:'Participants who start over every time',
    body:'There is no persistent participant identity anywhere in this market. Every visit, every operator, every document is a fresh start. The data generated has no memory and builds no value — for the operator or the participant.' },
  { title:"Platforms that sit outside the operator's stack",
    body:'Operators run booking systems, payment platforms, scheduling tools, and CRMs. Waiver platforms sit alongside this stack — siloed, manual, and disconnected. Integration is an afterthought, not an architecture.' },
  { title:'A category ceiling no one has broken through',
    body:'Every major platform — Smartwaiver, Wherewolf, and others — converged on the same output: a digital form, a captured signature, a stored record. The document got faster to sign. It never got smarter.' },
]

const DEFENSES = [
  { Icon:IconDocumentIntelligence, title:"The architecture isn't backportable",
    body:"Smartwaiver was built in 2010 as a digital form. Becoming AI-native isn't a feature release — it's a rebuild of the platform from scratch, underneath an existing operator base, without breaking anything. Most won't take the bet." },
  { Icon:IconAuditTrail, title:'The data moat compounds',
    body:"Every signing event produces labeled training signal — activity, risk profile, jurisdiction, outcome. Adaptive clause generation gets better in ways legacy can't match because legacy doesn't have the data architecture to capture the signal." },
  { Icon:IconLIABLPass, title:'The identity layer is a network effect',
    body:'LIABL Pass gets more valuable every time another operator joins. A copy launched tomorrow is empty for two to three years. First-mover advantage in identity networks is durable — Plaid, Persona, and Stripe Identity all proved it.' },
  { Icon:IconIntegration, title:'The integration surface is winner-take-most',
    body:'FareHarbor, Rezdy, Xola, and Bókun all launched APIs between 2021 and 2024. Becoming the default document layer for those platforms is a one-time race. Once standardized, switching costs become integration costs.' },
]

export default function CategoryHistorySubTab() {
  return (
    <div className="space-y-12">

      {/* ── Movement 1 — Timeline ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">The foundation</p>
        <h2 className="font-serif text-2xl text-ink mb-2" style={{ letterSpacing:'-0.015em' }}>From ink to digital.</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-2xl leading-relaxed">
          In 2000, a digital signature became legally equivalent to ink on paper. This single legislative moment created the entire digital document economy and set the stage for 25 years of platform evolution.
        </p>

        <div className="bg-white rounded-2xl border border-black/10 p-6">
          {/* Year row */}
          <div className="relative grid grid-cols-4 gap-4 mb-5">
            <div className="absolute top-[18px] left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-brand via-brand to-accent opacity-25" />
            {TIMELINE.map(t => (
              <div key={t.year} className="text-center relative">
                <div className={`rounded-full mx-auto mb-2 relative z-10 ${
                  t.accent ? 'w-[18px] h-[18px] bg-accent' : 'w-3.5 h-3.5 bg-brand'
                } mt-3`}
                  style={t.accent ? { boxShadow:'0 0 0 4px rgba(234,88,12,0.15)' } : undefined} />
                <div className="font-serif text-2xl font-medium leading-none" style={{
                  letterSpacing:'-0.02em',
                  color: t.accent ? '#EA580C' : '#0D0E12',
                }}>{t.year}</div>
              </div>
            ))}
          </div>

          {/* Era labels */}
          <div className="grid grid-cols-4 gap-4 mb-3">
            {TIMELINE.map(t => (
              <div key={t.year} className="text-center text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: t.accent ? '#EA580C' : '#6B7280' }}>
                {t.era}
              </div>
            ))}
          </div>

          {/* Era descriptions */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {TIMELINE.map(t => (
              <div key={t.year} className={t.accent ? 'bg-accent/5 border border-accent/25 rounded-xl p-3' : ''}>
                <p className={`text-xs font-medium mb-2 leading-snug ${t.accent ? 'text-accent-deep' : 'text-ink'}`}>
                  {t.headline}
                </p>
                <ul className="space-y-1 text-[11px] text-gray-500 leading-relaxed pl-3 list-disc list-outside">
                  {t.bullets.map(b => <li key={b}>{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Movement 2 — Four ceilings ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">The market in 2026</p>
        <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.015em' }}>Digital is solved. Intelligence is not.</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {CEILINGS.map(c => (
            <div key={c.title} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="font-medium text-sm text-ink mb-2 leading-snug">{c.title}</div>
              <p className="text-xs text-gray-500 leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>

        {/* First closing thesis */}
        <div className="bg-ink rounded-2xl p-6 text-white">
          <p className="text-sm leading-relaxed text-white/90">
            The high-risk document space has had a{' '}
            <span className="text-white font-medium">signature problem</span> since 2000 — and it solved it. What it has now is a{' '}
            <span className="text-accent font-medium">document intelligence problem</span> — and no platform has been built from the ground up to address it.
          </p>
        </div>
      </div>

      {/* ── Movement 3 — Defense of future state ── */}
      <div>
        <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">The durable advantage</p>
        <h2 className="font-serif text-2xl text-ink mb-2" style={{ letterSpacing:'-0.015em' }}>Why this gap stays closed.</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-2xl leading-relaxed">
          Four structural reasons document intelligence is the durable answer — not a fad, not something legacy can ship, not something that gets commoditized.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {DEFENSES.map(({ Icon, title, body }) => (
            <div key={title} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
                  <Icon size={16} color="#4B2ACF"/>
                </div>
                <div className="font-medium text-sm text-ink leading-snug pt-1">{title}</div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Second closing thesis */}
        <div className="bg-ink rounded-2xl p-6 text-white">
          <p className="text-sm leading-relaxed text-white/90">
            Document intelligence isn&apos;t a{' '}
            <span className="text-white font-medium">feature competitors can ship</span>. It&apos;s an{' '}
            <span className="text-accent font-medium">architecture they&apos;d have to rebuild from scratch</span> — without the data, without the identity layer, and without the integrations LIABL is already winning.
          </p>
        </div>
      </div>

    </div>
  )
}
