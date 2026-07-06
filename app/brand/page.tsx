'use client'
import { useState } from 'react'
import Link from 'next/link'
import Logo            from '@/components/Logo'
import LogoConceptA    from '@/components/logo/LogoConceptA'
import LogoConceptB    from '@/components/logo/LogoConceptB'
import LogoConceptC    from '@/components/logo/LogoConceptC'
import { ICON_LIBRARY } from '@/components/icons'

const PALETTE = [
  { name:'Brand · Indigo',  hex:'#4B2ACF', use:'Primary brand color. Logo mark, CTAs, headers.',           token:'brand'   },
  { name:'Brand · Light',   hex:'#EEE9FF', use:'Brand backgrounds, hover states, soft accents.',            token:'brand-light' },
  { name:'Accent · Orange', hex:'#EA580C', use:'Energy, signature stroke, secondary CTAs, momentum.',       token:'accent'  },
  { name:'Accent · Light',  hex:'#FFEDD5', use:'Accent backgrounds, warm-toned callouts.',                  token:'accent-light' },
  { name:'Success · Forest',hex:'#15803D', use:'RESERVED — only for Signed and Verified states.',           token:'success' },
  { name:'Success · Light', hex:'#DCFCE7', use:'Verified backgrounds, signed-state surfaces.',              token:'success-light' },
  { name:'Slate',           hex:'#334155', use:'Structural moments — neutral positive states, charts.',     token:'slate'   },
  { name:'Slate · Light',   hex:'#F1F5F9', use:'Slate backgrounds, neutral status surfaces.',               token:'slate-light' },
  { name:'Surface',         hex:'#F7F6F2', use:'Page background. Off-white, warm, calm.',                   token:'surface' },
  { name:'Ink',             hex:'#0D0E12', use:'Primary text, dark surfaces, headlines.',                   token:'ink'     },
  { name:'Muted Gray',      hex:'#6B7280', use:'Secondary text, borders, dividers.',                        token:'muted'   },
]

const COMPONENTS_DEMO = [
  { name:'Primary Button',   element:<button className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all">Start Free Trial</button> },
  { name:'Accent Button',    element:<button className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all">Get Started</button>     },
  { name:'Verified Button',  element:<button className="px-5 py-2.5 bg-success text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all">Verified ✓</button>      },
  { name:'Secondary Button', element:<button className="px-5 py-2.5 bg-surface border border-ink/15 text-ink rounded-xl text-sm font-semibold hover:bg-white transition-all">Learn More</button> },
  { name:'Signed Badge',     element:<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-success-light text-success-deep border border-success/20">Signed</span> },
  { name:'Pending Badge',    element:<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Pending</span> },
  { name:'Pass Badge',       element:<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-light text-brand border border-brand/20">✦ LIABL Pass</span> },
  { name:'Risk Badge',       element:<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-accent-light text-accent-deep border border-accent/20">⚡ Risk · 42</span> },
  { name:'Slate Badge',      element:<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-light text-slate-deep border border-slate/20">Active</span> },
  { name:'Neutral Badge',    element:<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface text-muted border border-ink/10">Draft</span> },
]

const PERSONALITY = [
  { word:'Simple',     desc:'Plain language. Clear hierarchy. Nothing decorative. Every element earns its place.' },
  { word:'Trusted',    desc:'Confident, factual, and verifiable. Specifics over adjectives. Numbers over claims.' },
  { word:'Intelligent',desc:'AI-native by architecture, not by marketing. The product proves the intelligence — the brand reinforces it.' },
]

export default function BrandBook() {
  const [iconSize, setIconSize] = useState(28)
  const [showArchive, setShowArchive] = useState(false)

  return (
    <main className="min-h-screen bg-surface">
      <nav className="bg-white border-b border-ink/10 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <Logo size="md"/>
        <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">← Home</Link>
      </nav>

      {/* Hero */}
      <section className="px-6 py-14 bg-white border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-xs font-semibold px-3 py-1.5 rounded-full mb-5 border border-brand/20">
            BRAND BOOK · v18 — LOCKED
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl text-ink mb-4 leading-tight" style={{ letterSpacing:'-0.025em' }}>
            The LIABL Brand System.
          </h1>
          <p className="text-muted text-lg leading-relaxed max-w-2xl">
            Simple, trusted, intelligent. The locked brand system for an AI-native document intelligence platform —
            ready for the investor pitch, the operator demo, and everything that comes next.
          </p>
        </div>
      </section>

      {/* Personality */}
      <section className="px-6 py-12 border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">01 · Personality</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>
            Three words. Every decision flows from these.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PERSONALITY.map(({ word, desc }) => (
              <div key={word} className="bg-white rounded-2xl border border-ink/10 p-5">
                <div className="font-serif text-xl text-brand mb-2" style={{ letterSpacing:'-0.01em' }}>{word}</div>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-ink rounded-2xl p-5 mt-4 text-white">
            <div className="text-xs font-semibold tracking-widest uppercase mb-2 text-white/60">Reference Brands</div>
            <p className="text-white/80 leading-relaxed">
              LIABL aspires to the intersection of <strong className="text-white">Figma</strong> (modern, intelligent, software-fluent) and <strong className="text-white">Patagonia</strong> (active, outdoor heritage, real-world durability).
              Software credibility for investors. Outdoor authenticity for operators. Both audiences served by the same brand.
            </p>
          </div>
        </div>
      </section>

      {/* Logo — LOCKED */}
      <section className="px-6 py-12 border-b border-ink/8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold tracking-widest text-brand uppercase">02 · Logo · LOCKED</p>
            <span className="text-xs bg-success-light text-success-deep border border-success/20 px-2 py-0.5 rounded-full font-medium">✓ Final</span>
          </div>
          <h2 className="font-serif text-2xl text-ink mb-1" style={{ letterSpacing:'-0.01em' }}>
            Document intelligence, made literal.
          </h2>
          <p className="text-sm text-muted mb-8 max-w-2xl">
            The L letterform is the document — folded corner at the top of the spine references a signed page,
            and the orange signature line beneath the L base marks the moment of signing.
            One mark, three meanings: letter, document, signature.
          </p>

          {/* Full logo at scale */}
          <div className="bg-surface rounded-2xl border border-ink/10 p-16 flex items-center justify-center mb-4 min-h-48">
            <Logo size="lg"/>
          </div>

          {/* Size variations */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-surface rounded-xl border border-ink/10 p-6 flex flex-col items-center justify-center min-h-32">
              <div className="mb-3 flex items-center justify-center" style={{ minHeight:60 }}>
                <Logo size="sm"/>
              </div>
              <div className="text-xs text-muted uppercase tracking-wider">Small</div>
            </div>
            <div className="bg-surface rounded-xl border border-ink/10 p-6 flex flex-col items-center justify-center min-h-32">
              <div className="mb-3 flex items-center justify-center" style={{ minHeight:60 }}>
                <Logo size="md"/>
              </div>
              <div className="text-xs text-muted uppercase tracking-wider">Medium</div>
            </div>
            <div className="bg-surface rounded-xl border border-ink/10 p-6 flex flex-col items-center justify-center min-h-32">
              <div className="mb-3 flex items-center justify-center" style={{ minHeight:60 }}>
                <Logo size="lg"/>
              </div>
              <div className="text-xs text-muted uppercase tracking-wider">Large</div>
            </div>
          </div>

          {/* Mark only — favicon scale */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface rounded-xl border border-ink/10 p-6 flex flex-col items-center">
              <div className="mb-3 flex items-center justify-center" style={{ minHeight:60 }}>
                <Logo size="md" markOnly/>
              </div>
              <div className="text-xs text-muted uppercase tracking-wider">Mark · 32px</div>
            </div>
            <div className="bg-surface rounded-xl border border-ink/10 p-6 flex flex-col items-center">
              <div className="mb-3 flex items-center justify-center" style={{ minHeight:60 }}>
                <Logo size="lg" markOnly/>
              </div>
              <div className="text-xs text-muted uppercase tracking-wider">Mark · 52px</div>
            </div>
            <div className="bg-ink rounded-xl border border-ink/10 p-6 flex flex-col items-center">
              <div className="mb-3 flex items-center justify-center" style={{ minHeight:60 }}>
                <Logo size="md" dark/>
              </div>
              <div className="text-xs text-white/60 uppercase tracking-wider">On Dark</div>
            </div>
          </div>

          {/* Tagline */}
          <div className="bg-brand text-white rounded-2xl p-6">
            <div className="text-xs font-semibold tracking-widest uppercase mb-2 text-white/60">Tagline</div>
            <div className="font-serif text-3xl mb-2" style={{ letterSpacing:'-0.02em' }}>Documents that adapt.</div>
            <p className="text-white/80 text-sm leading-relaxed">
              The tagline is the architecture. Every LIABL document is generated, not stored — it adapts to the participant,
              the activity, the risk profile, and the jurisdiction in real time.
              &ldquo;Adapt&rdquo; is the single verb that captures what LIABL does that legacy tools cannot.
            </p>
          </div>

          {/* Archive toggle */}
          <div className="mt-6 text-center">
            <button onClick={() => setShowArchive(!showArchive)}
              className="text-sm text-muted underline hover:text-ink transition-colors">
              {showArchive ? 'Hide' : 'Show'} concept exploration archive →
            </button>
          </div>

          {showArchive && (
            <div className="mt-6 bg-surface rounded-2xl border border-ink/10 p-6 animate-fade-up">
              <div className="text-xs font-semibold tracking-widest uppercase mb-3 text-muted">Concept exploration · archived</div>
              <p className="text-sm text-muted mb-5 leading-relaxed">
                Three concepts were explored during the logo design process. The locked direction above evolved from Concept A
                with the verification seal removed and the L letterform integrated as the focal element.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-ink/10 p-5 flex flex-col items-center text-center">
                  <div className="mb-3"><LogoConceptA size="md" markOnly/></div>
                  <div className="text-xs font-medium text-ink mb-1">Concept A · Seal</div>
                  <div className="text-xs text-muted">Document with verification seal</div>
                </div>
                <div className="bg-white rounded-xl border border-ink/10 p-5 flex flex-col items-center text-center">
                  <div className="mb-3"><LogoConceptB size="md" markOnly/></div>
                  <div className="text-xs font-medium text-ink mb-1">Concept B · Momentum</div>
                  <div className="text-xs text-muted">Ascending signal bars</div>
                </div>
                <div className="bg-white rounded-xl border border-ink/10 p-5 flex flex-col items-center text-center">
                  <div className="mb-3"><LogoConceptC size="md" markOnly/></div>
                  <div className="text-xs font-medium text-ink mb-1">Concept C · Monogram</div>
                  <div className="text-xs text-muted">Earlier L iteration</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Color palette */}
      <section className="px-6 py-12 border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">03 · Color</p>
          <h2 className="font-serif text-2xl text-ink mb-1" style={{ letterSpacing:'-0.01em' }}>
            Indigo, Orange, Forest, Slate, Gray.
          </h2>
          <p className="text-sm text-muted mb-8 max-w-2xl">
            Indigo grounds intelligence and trust. Orange brings energy. Forest is <strong>reserved exclusively</strong> for Signed and Verified moments —
            where users need instant recognition. Slate handles structural positive states. Gray and ink do the structural work.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PALETTE.map(({ name, hex, use, token }) => (
              <div key={hex} className="bg-white rounded-2xl border border-ink/10 overflow-hidden">
                <div className="h-24" style={{ background:hex }}/>
                <div className="p-4">
                  <div className="font-semibold text-sm text-ink mb-0.5">{name}</div>
                  <div className="font-mono text-xs text-muted mb-2">{hex}</div>
                  <div className="text-xs text-muted leading-snug mb-2">{use}</div>
                  <div className="font-mono text-xs text-brand">.bg-{token}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="px-6 py-12 border-b border-ink/8 bg-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">04 · Typography</p>
          <h2 className="font-serif text-2xl text-ink mb-1" style={{ letterSpacing:'-0.01em' }}>Three families. Clear roles.</h2>
          <p className="text-sm text-muted mb-8 max-w-2xl">Syne for display moments. DM Sans for everything else. JetBrains Mono for data, code, and document IDs.</p>

          <div className="space-y-4">
            <div className="bg-surface rounded-2xl border border-ink/10 p-6">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Display · Syne</div>
              <div className="font-serif text-4xl text-ink mb-1" style={{ letterSpacing:'-0.02em' }}>
                Documents that adapt.
              </div>
              <div className="text-sm text-muted">Headlines, hero text, section openers. Reserved for moments that demand presence.</div>
            </div>
            <div className="bg-surface rounded-2xl border border-ink/10 p-6">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Body · DM Sans</div>
              <div className="text-base text-ink mb-1 leading-relaxed">
                LIABL builds the document from the participant&apos;s answers in real time — adaptive, activity-specific, and legally defensible from the first signature.
              </div>
              <div className="text-sm text-muted mt-2">Paragraph text, UI labels, descriptions. The workhorse of the system.</div>
            </div>
            <div className="bg-surface rounded-2xl border border-ink/10 p-6">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Mono · JetBrains Mono</div>
              <div className="font-mono text-sm text-ink mb-1">doc_a1b2c3d4 · SHA-256: 7f3a9c21...</div>
              <div className="text-sm text-muted">Document IDs, hashes, code, technical data.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Icons */}
      <section className="px-6 py-12 border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">05 · Icon System</p>
          <h2 className="font-serif text-2xl text-ink mb-1" style={{ letterSpacing:'-0.01em' }}>Custom line-art. No more emojis.</h2>
          <p className="text-sm text-muted mb-6 max-w-2xl">20 icons on a consistent 24×24 grid, 1.5px line weight, rounded caps and joins.</p>

          <div className="flex items-center gap-3 mb-4 text-sm">
            <span className="text-muted">Size</span>
            <input type="range" min={16} max={48} step={2} value={iconSize} onChange={e=>setIconSize(Number(e.target.value))} className="w-32"/>
            <span className="font-mono text-xs text-muted">{iconSize}px</span>
          </div>

          {(Object.entries(ICON_LIBRARY) as [string, typeof ICON_LIBRARY[keyof typeof ICON_LIBRARY]][]).map(([category, icons]) => (
            <div key={category} className="mb-6">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 capitalize">{category}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {icons.map(({ name, Component }) => (
                  <div key={name} className="bg-white rounded-xl border border-ink/10 p-4 flex flex-col items-center justify-center text-center hover:border-brand/30 transition-colors">
                    <div className="text-ink mb-3 flex items-center justify-center" style={{ minHeight:48 }}>
                      <Component size={iconSize} />
                    </div>
                    <div className="text-xs font-medium text-ink">{name}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Components */}
      <section className="px-6 py-12 border-b border-ink/8 bg-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">06 · Components</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>The applied system.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COMPONENTS_DEMO.map(({ name, element }) => (
              <div key={name} className="bg-surface rounded-2xl border border-ink/10 p-5">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{name}</div>
                <div className="flex items-center justify-center min-h-12">{element}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice & tone */}
      <section className="px-6 py-12 border-b border-ink/8">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-brand uppercase mb-2">07 · Voice & Tone</p>
          <h2 className="font-serif text-2xl text-ink mb-6" style={{ letterSpacing:'-0.01em' }}>How LIABL sounds.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-success-light border border-success/20 rounded-2xl p-5">
              <div className="text-xs font-semibold text-success-deep uppercase tracking-wider mb-3">✓ We do this</div>
              <ul className="space-y-2 text-sm text-ink leading-relaxed">
                <li>&ldquo;Documents that adapt.&rdquo;</li>
                <li>&ldquo;187 staff-hours recovered per year.&rdquo;</li>
                <li>&ldquo;Document sealed at signing time.&rdquo;</li>
                <li>&ldquo;The document builds itself from answers.&rdquo;</li>
              </ul>
            </div>
            <div className="bg-accent-light border border-accent/20 rounded-2xl p-5">
              <div className="text-xs font-semibold text-accent-deep uppercase tracking-wider mb-3">✗ We don&apos;t do this</div>
              <ul className="space-y-2 text-sm text-ink leading-relaxed">
                <li>&ldquo;Revolutionary AI-powered solution.&rdquo;</li>
                <li>&ldquo;Game-changing platform.&rdquo;</li>
                <li>&ldquo;Best-in-class document management.&rdquo;</li>
                <li>&ldquo;Empowering operators to leverage synergies.&rdquo;</li>
              </ul>
            </div>
          </div>
          <div className="bg-ink rounded-2xl p-6 mt-4 text-white">
            <div className="font-semibold mb-3">Three rules for everything LIABL writes:</div>
            <ol className="space-y-2 text-sm text-white/80">
              <li><strong className="text-white">1. Specifics over adjectives.</strong> &ldquo;187 hours saved&rdquo; not &ldquo;significant time savings.&rdquo;</li>
              <li><strong className="text-white">2. Plain language always.</strong> If your operator wouldn&apos;t say it, neither should we.</li>
              <li><strong className="text-white">3. Show, don&apos;t claim.</strong> Demonstrate the intelligence — don&apos;t announce it.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* CTA — pitch deck assets */}
      <section className="px-6 py-12 border-b border-ink/8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-ink rounded-2xl p-8 text-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div>
                <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color:'#A78BFA' }}>For the pitch deck</div>
                <h3 className="font-serif text-2xl mb-2" style={{ letterSpacing:'-0.01em' }}>
                  Pitch deck asset bundle.
                </h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Logo files in SVG and PNG, color palette card, brand one-pager, and AI-first positioning statement —
                  all formatted for drop-in use in your investor materials.
                </p>
              </div>
              <div className="text-right">
                <Link href="/brand/assets"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-ink rounded-xl text-sm font-semibold hover:bg-white/90 transition-all">
                  View asset bundle →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 bg-ink text-center border-t border-white/10">
        <p className="text-xs text-white/40">LIABL Brand Book · v18 · Locked</p>
      </footer>
    </main>
  )
}
