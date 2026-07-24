// Concept C — Monogram L Mark
// A stylized L that does visual work — the L is formed by a document corner
// with an accent momentum line that suggests both signing and motion.
// Confident as a standalone mark for favicon/app icon, elegant alongside wordmark.
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

export default function LogoConceptC({ size='md', dark=false, markOnly=false }: Props) {
  const s = sizes[size]
  const markColor = '#4B2ACF'
  const accentColor = '#EA580C'
  const wordColor = dark ? '#FFFFFF' : '#0D0E12'
  const tagColor  = dark ? 'rgba(255,255,255,0.5)' : 'rgba(13,14,18,0.4)'

  // Stylized L:
  // - Tall vertical stroke (the L spine)
  // - Horizontal base (the L foot)
  // - Document-corner notch at top-right of the vertical, suggesting a folded page
  // - Orange accent line cutting through the L base, suggesting momentum/signature stroke
  const Mark = (
    <svg width={s.mark} height={s.mark} viewBox="0 0 48 48" fill="none">
      {/* Background — rounded square */}
      <rect width="48" height="48" rx="10" fill={markColor}/>

      {/* The L itself — formed by two rectangles */}
      {/* Vertical spine of L */}
      <rect x="11" y="9" width="8" height="24" rx="1.5" fill="#FFFFFF"/>
      {/* Horizontal base of L */}
      <rect x="11" y="29" width="22" height="8" rx="1.5" fill="#FFFFFF"/>

      {/* Document corner fold — small triangle at top-right of the L's spine,
          suggesting this L is also a folded document corner */}
      <path d="M19 9 L19 15 L25 15 Z" fill="#FFFFFF" opacity="0.5"/>
      <path d="M19 9 L25 15 L19 15 Z" fill="#FFFFFF" opacity="0.85"/>

      {/* Orange accent — momentum/signature stroke cutting through the L base */}
      <rect x="14" y="32.5" width="16" height="1.5" fill={accentColor} opacity="0.9"/>
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
