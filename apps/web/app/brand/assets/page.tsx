'use client'
import Link from 'next/link'
import Logo from '@/components/Logo'

const POSITIONING_STATEMENT = `LIABL is the first AI-native document intelligence platform for the activity industry. While legacy competitors built digital versions of paper forms in 2010 and 2014, LIABL was architected from the ground up as intelligence infrastructure. Every signature is a data event. Every answer is a risk signal. Every returning participant is a node in a verified identity graph that compounds with every signing event across every operator. At 5,000 operators, 68% of participants arrive already recognized — recognition that cannot be replicated by adding AI features to a legacy tool.`

const PALETTE = [
  { name:'Indigo',   hex:'#4B2ACF', role:'Primary' },
  { name:'Orange',   hex:'#EA580C', role:'Accent'  },
  { name:'Forest',   hex:'#15803D', role:'Verified · Signed only' },
  { name:'Slate',    hex:'#334155', role:'Structural' },
  { name:'Surface',  hex:'#F7F6F2', role:'Background' },
  { name:'Ink',      hex:'#0D0E12', role:'Text' },
]

const KEY_STATS = [
  { value:'< 2 min',  label:'First-time participant signing'  },
  { value:'~15 sec',  label:'Returning participant via LIABL Pass' },
  { value:'68%',      label:'Cross-operator recognition at 5K operators' },
  { value:'$3,366',   label:'Average operator labor recovered per year' },
  { value:'8–15%',    label:'Insurance premium reduction for LIABL operators' },
  { value:'$4.2M',    label:'Average recreational liability settlement avoided' },
]

const TAGLINE_USE = [
  { context:'Logo lockup',         usage:'Documents that adapt.',                                                  format:'Sentence case · period included' },
  { context:'Hero / hero variant', usage:'Your waiver shouldn\'t be a form. It should be thinking.',              format:'Full headline · echoes tagline philosophy' },
  { context:'Subtitle / support',  usage:'The first AI-native document intelligence platform for the activity industry.', format:'Positioning statement · plain text' },
]

export default function PitchDeckAssets() {
  return (
    <main className="min-h-screen bg-surface">
      <nav className="bg-white border-b border-ink/10 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <Logo size="md"/>
        <div className="flex items-center gap-3">
          <Link href="/brand" className="text-sm text-muted hover:text-ink transition-colors">← Brand book</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-14 bg-white border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-xs font-semibold px-3 py-1.5 rounded-full mb-5 border border-brand/20">
            PITCH DECK ASSETS
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-ink mb-4 leading-tight" style={{ letterSpacing:'-0.025em' }}>
            Ready for the deck.
          </h1>
          <p className="text-muted text-lg leading-relaxed max-w-2xl">
            Locked logo, palette, key stats, and positioning copy — all formatted for drop-in use in investor materials.
            Right-click any logo or copy any block to use directly.
          </p>
        </div>
      </section>

      {/* Logo files */}
      <section className="px-6 py-12 border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Logo Files</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>The mark, ready for any context.</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Full lockup — light */}
            <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden">
              <div className="bg-surface p-12 flex items-center justify-center min-h-40">
                <Logo size="lg"/>
              </div>
              <div className="p-4 border-t border-ink/8">
                <div className="text-sm font-semibold text-ink mb-1">Full lockup · Light background</div>
                <div className="text-xs text-muted">For light surfaces, the standard usage. Tagline shown at lg size only.</div>
              </div>
            </div>

            {/* Full lockup — dark */}
            <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden">
              <div className="bg-ink p-12 flex items-center justify-center min-h-40">
                <Logo size="lg" dark/>
              </div>
              <div className="p-4 border-t border-ink/8">
                <div className="text-sm font-semibold text-ink mb-1">Full lockup · Dark background</div>
                <div className="text-xs text-muted">For dark surfaces. Wordmark color flips to white, mark colors unchanged.</div>
              </div>
            </div>

            {/* Mark only */}
            <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden">
              <div className="bg-surface p-12 flex items-center justify-center min-h-40">
                <Logo size="lg" markOnly/>
              </div>
              <div className="p-4 border-t border-ink/8">
                <div className="text-sm font-semibold text-ink mb-1">Mark only · 52px</div>
                <div className="text-xs text-muted">For favicons, app icons, social profile images, and very small spaces.</div>
              </div>
            </div>

            {/* Mark only on dark */}
            <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden">
              <div className="bg-ink p-12 flex items-center justify-center min-h-40">
                <Logo size="lg" markOnly/>
              </div>
              <div className="p-4 border-t border-ink/8">
                <div className="text-sm font-semibold text-ink mb-1">Mark only · On dark</div>
                <div className="text-xs text-muted">The mark itself is full-color on both light and dark surfaces.</div>
              </div>
            </div>
          </div>

          {/* Clear space rules */}
          <div className="bg-white rounded-2xl border border-ink/10 p-5 mt-4">
            <div className="text-sm font-semibold text-ink mb-3">Usage rules</div>
            <ul className="space-y-2 text-sm text-muted">
              <li><strong className="text-ink">Clear space:</strong> Maintain a clear space around the logo equal to the height of the L spine in the mark.</li>
              <li><strong className="text-ink">Minimum size:</strong> Full lockup minimum 80px wide. Mark only minimum 16px.</li>
              <li><strong className="text-ink">Never:</strong> Rotate, recolor, stretch, or apply effects (shadow, gradient, glow) to the mark. Never separate the wordmark from the mark in lockup contexts.</li>
              <li><strong className="text-ink">Tagline:</strong> Only appears with the lg size lockup. Smaller sizes omit it for clarity.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Color palette card */}
      <section className="px-6 py-12 border-b border-ink/8 bg-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Color Palette</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>One-page reference.</h2>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {PALETTE.map(({ name, hex, role }) => (
              <div key={hex} className="bg-surface rounded-xl border border-ink/10 overflow-hidden">
                <div className="h-20" style={{ background: hex }}/>
                <div className="p-3">
                  <div className="text-xs font-semibold text-ink mb-0.5">{name}</div>
                  <div className="font-mono text-xs text-muted mb-1">{hex}</div>
                  <div className="text-xs text-muted leading-snug">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Positioning statement */}
      <section className="px-6 py-12 border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Positioning Statement</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>Copy-ready for the deck.</h2>

          <div className="bg-ink rounded-2xl p-8 text-white">
            <div className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color:'#A78BFA' }}>The AI-native positioning</div>
            <p className="text-white/90 text-base leading-relaxed font-serif" style={{ letterSpacing:'-0.01em' }}>
              {POSITIONING_STATEMENT}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="bg-white rounded-xl border border-ink/10 p-4">
              <div className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Short version · 1 line</div>
              <p className="text-sm text-ink font-serif" style={{ letterSpacing:'-0.01em' }}>
                The first AI-native document intelligence platform for the activity industry.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-ink/10 p-4">
              <div className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Medium version · 2 sentences</div>
              <p className="text-sm text-ink leading-relaxed">
                Legacy waiver tools were built in 2010 as digital paper forms. LIABL is AI-native from the ground up — adaptive documents, real-time risk intelligence, and a participant identity graph that compounds with every signature.
              </p>
            </div>
            <div className="bg-white rounded-xl border border-ink/10 p-4">
              <div className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Tagline</div>
              <p className="text-base text-ink font-serif" style={{ letterSpacing:'-0.01em' }}>
                Documents that adapt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key stats */}
      <section className="px-6 py-12 border-b border-ink/8 bg-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Key Stats</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>Numbers for slides.</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {KEY_STATS.map(({ value, label }) => (
              <div key={label} className="bg-surface rounded-2xl border border-ink/10 p-5">
                <div className="font-serif text-3xl text-brand font-semibold mb-2" style={{ letterSpacing:'-0.02em' }}>{value}</div>
                <div className="text-xs text-muted leading-snug">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tagline usage guide */}
      <section className="px-6 py-12 border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Tagline Usage</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>Where it lives, how to use it.</h2>

          <div className="bg-white rounded-2xl border border-ink/10 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-ink/8 bg-surface/40">
              <div className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Context</div>
              <div className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider sm:col-span-1">Usage</div>
              <div className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Format</div>
            </div>
            {TAGLINE_USE.map(({ context, usage, format }, i) => (
              <div key={i} className={`grid grid-cols-1 sm:grid-cols-3 ${i > 0 ? 'border-t border-ink/5' : ''}`}>
                <div className="px-5 py-4 text-sm font-medium text-ink">{context}</div>
                <div className="px-5 py-4 text-sm text-ink font-serif" style={{ letterSpacing:'-0.01em' }}>&ldquo;{usage}&rdquo;</div>
                <div className="px-5 py-4 text-xs text-muted">{format}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pitch deck recommended sections */}
      <section className="px-6 py-12 border-b border-ink/8 bg-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">Pitch Deck Outline</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>A recommended slide order.</h2>

          <div className="space-y-2">
            {[
              { num:'01', title:'Title',                    body:'LIABL · Documents that adapt. · The first AI-native document intelligence platform for the activity industry.' },
              { num:'02', title:'The category',             body:'Liability waivers in the activity industry — $887B outdoor recreation economy, 24% growth, no AI-native player.' },
              { num:'03', title:'The legacy problem',       body:'Smartwaiver (2010) and Wherewolf (2014) are digital versions of paper forms. Static templates, no intelligence, no network.' },
              { num:'04', title:'The architectural shift',  body:'LIABL is AI-native from the ground up — adaptive documents, real-time risk intelligence, participant identity graph.' },
              { num:'05', title:'How it works',             body:'3 steps: operator configures activity → participant scans and signs → waiver appears in dashboard with risk score.' },
              { num:'06', title:'The product',              body:'Live adaptive demo. Risk profile in real time. Network effect simulator.' },
              { num:'07', title:'Three segments',           body:'Independent operators, enterprise multi-location, booking platform partners. Same platform, different value.' },
              { num:'08', title:'The network thesis',       body:'At 5,000 operators, 68% of participants arrive already recognized. The moat compounds.' },
              { num:'09', title:'Business case',            body:'$3,366/yr labor recovered per operator. 8-15% insurance premium reduction. Pays for itself in 30 days.' },
              { num:'10', title:'Pricing',                  body:'Core $49 · Connected $149 · Intelligence $349. Feature-based, unlimited participants, overage flexibility.' },
              { num:'11', title:'Go-to-market',             body:'Direct operators (Segment A), enterprise sales (Segment B), platform partnerships (Segment C — FareHarbor, etc.).' },
              { num:'12', title:'The team',                 body:'[Your team here]' },
              { num:'13', title:'The ask',                  body:'[Funding amount, milestones, runway]' },
              { num:'14', title:'Close',                    body:'The window: legacy tools have 20 years of inertia, but no AI architecture. We build the moat now.' },
            ].map(({ num, title, body }) => (
              <div key={num} className="bg-surface rounded-xl border border-ink/10 p-4 flex gap-4">
                <div className="font-serif text-xl font-bold text-brand/40 shrink-0 w-10 leading-none">{num}</div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-ink mb-0.5">{title}</div>
                  <div className="text-xs text-muted leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 bg-ink text-center border-t border-white/10">
        <p className="text-xs text-white/40">LIABL Pitch Deck Asset Bundle · v18</p>
      </footer>
    </main>
  )
}
