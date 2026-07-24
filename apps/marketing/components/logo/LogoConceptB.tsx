// Concept B — Momentum/Intelligence Mark
// Three ascending geometric forms suggesting forward motion, signal, intelligence.
// Less literal — closer to Linear's abstract geometry but with an active, ascending quality.
interface Props {
  size?: 'sm' | 'md' | 'lg'
  dark?: boolean
  markOnly?: boolean
}

const sizes = {
  sm: { mark:24, word:18, tag:10, gap:7  },
  md: { mark:32, word:24, tag:11, gap:9  },
  lg: { mark:52, word:40, tag:12, gap:14 },
}

export default function LogoConceptB({ size='md', dark=false, markOnly=false }: Props) {
  const s = sizes[size]
  const markColor = '#4B2ACF'
  const accentColor = '#EA580C'
  const successColor = '#15803D'
  const wordColor = dark ? '#FFFFFF' : '#0D0E12'
  const tagColor  = dark ? 'rgba(255,255,255,0.5)' : 'rgba(13,14,18,0.4)'

  // Three ascending bars at angles — suggests momentum, signal strength,
  // ascending intelligence. Each bar shifts forward and up, like signal compounding.
  const Mark = (
    <svg width={s.mark} height={s.mark} viewBox="0 0 48 48" fill="none">
      {/* Background rounded square */}
      <rect width="48" height="48" rx="10" fill="#0D0E12"/>
      {/* Bar 1 — short, base */}
      <rect x="9"  y="28" width="6" height="11" rx="2" fill={successColor}/>
      {/* Bar 2 — medium */}
      <rect x="19" y="20" width="6" height="19" rx="2" fill={accentColor}/>
      {/* Bar 3 — tallest, leading */}
      <rect x="29" y="10" width="6" height="29" rx="2" fill="#FFFFFF"/>
      {/* Tip arrow / signal at top of tallest */}
      <path d="M29 10 L32 6 L35 10 Z" fill="#FFFFFF"/>
    </svg>
  )

  if (markOnly) return Mark

  return (
    <div style={{ display:'flex', alignItems:'center', gap:s.gap }}>
      {Mark}
      <div>
        <div style={{
          fontFamily:'Inter, system-ui, sans-serif',
          fontWeight:700,
          fontSize:s.word,
          letterSpacing:'0.08em',
          color:wordColor,
          lineHeight:1,
        }}>LIABL</div>
        {size === 'lg' && (
          <div style={{
            fontFamily:'Inter, system-ui, sans-serif',
            fontWeight:500,
            fontSize:s.tag,
            letterSpacing:'0.16em',
            color:tagColor,
            marginTop:5,
            textTransform:'uppercase',
          }}>Document Intelligence</div>
        )}
      </div>
    </div>
  )
}
