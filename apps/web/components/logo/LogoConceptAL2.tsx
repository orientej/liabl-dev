// Concept A · L Variant 2 — Serif L
// Alternative letterform — a more editorial, serif-influenced L inside the seal.
// Uses filled shapes rather than strokes for a more weighted, refined feel.
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

export default function LogoConceptAL2({ size='md', dark=false, markOnly=false }: Props) {
  const s = sizes[size]
  const markColor = '#4B2ACF'
  const accentColor = '#EA580C'
  const wordColor = dark ? '#FFFFFF' : '#0D0E12'
  const tagColor  = dark ? 'rgba(255,255,255,0.5)' : 'rgba(13,14,18,0.4)'

  const Mark = (
    <svg width={s.mark} height={s.mark} viewBox="0 0 48 48" fill="none">
      {/* Outer document shape */}
      <path
        d="M8 6 C8 4.9 8.9 4 10 4 L32 4 L42 14 L42 38 C42 39.1 41.1 40 40 40 L10 40 C8.9 40 8 39.1 8 38 Z"
        fill={markColor}
      />
      {/* Folded corner */}
      <path d="M32 4 L42 14 L34 14 C32.9 14 32 13.1 32 12 Z" fill={accentColor} />

      {/* Verification seal — inner circle */}
      <circle cx="25" cy="26" r="9" fill="none" stroke="white" strokeWidth="2.2"/>

      {/* Filled L — weighted blocks, more confident presence */}
      {/* Vertical spine */}
      <rect x="21.5" y="21" width="3" height="10" rx="0.5" fill="white"/>
      {/* Horizontal base */}
      <rect x="21.5" y="28" width="8" height="3" rx="0.5" fill="white"/>
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
