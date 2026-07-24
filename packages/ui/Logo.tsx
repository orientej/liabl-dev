// LIABL Canonical Logo — v18 lock
// Direction 3: indigo rounded square, white L letterform with folded corner
// at top of spine, orange signature line beneath the base.
// Tagline: "Documents that adapt."

interface Props {
  size?: 'sm' | 'md' | 'lg'
  dark?: boolean
  operatorName?: string
  operatorAccent?: string
  markOnly?: boolean
}

const sizes = {
  sm: { mark:24, word:18, tag:10, gap:7  },
  md: { mark:32, word:24, tag:11, gap:9  },
  lg: { mark:52, word:40, tag:12, gap:14 },
}

export default function Logo({ size='md', dark=false, operatorName, operatorAccent, markOnly=false }: Props) {
  const s = sizes[size]
  const markBg     = operatorAccent ?? '#4B2ACF'
  const accentColor = '#EA580C'
  const wordColor   = dark ? '#FFFFFF' : '#0D0E12'
  const tagColor    = dark ? 'rgba(255,255,255,0.5)' : 'rgba(13,14,18,0.4)'

  const Mark = (
    <svg width={s.mark} height={s.mark} viewBox="0 0 48 48" fill="none" style={{ flexShrink:0 }}>
      {/* Indigo rounded-square background */}
      <rect width="48" height="48" rx="10" fill={markBg}/>
      {/* L spine with folded top-right corner */}
      <path d="M14 11 L18 11 L24 17 L24 35 L14 35 Z" fill="#FFFFFF"/>
      {/* Folded corner — lighter triangle */}
      <path d="M18 11 L24 17 L18 17 Z" fill="#FFFFFF" opacity="0.5"/>
      {/* L horizontal base */}
      <rect x="14" y="29" width="20" height="6" rx="0.8" fill="#FFFFFF"/>
      {/* Orange signature line beneath the L base */}
      <rect x="14" y="38.5" width="20" height="1.5" rx="0.75" fill={accentColor}/>
    </svg>
  )

  if (markOnly) return Mark

  return (
    <div style={{ display:'flex', alignItems:'center', gap:s.gap }}>
      {Mark}
      <div>
        <div style={{
          fontFamily:'Inter, system-ui, -apple-system, sans-serif',
          fontWeight:700,
          fontSize:s.word,
          letterSpacing:'0.08em',
          color:wordColor,
          lineHeight:1,
        }}>LIABL</div>
        {size === 'lg' && !operatorName && (
          <div style={{
            fontFamily:'Inter, system-ui, -apple-system, sans-serif',
            fontWeight:500,
            fontSize:s.tag,
            letterSpacing:'0.16em',
            color:tagColor,
            marginTop:5,
            textTransform:'uppercase',
          }}>Documents that adapt</div>
        )}
        {operatorName && (
          <div style={{
            fontFamily:'Inter, system-ui, -apple-system, sans-serif',
            fontWeight:500,
            fontSize:s.tag,
            letterSpacing:'0.04em',
            color:tagColor,
            marginTop:2,
          }}>{operatorName}</div>
        )}
      </div>
    </div>
  )
}
