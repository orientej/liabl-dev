// LIABL Custom Icon Library
// Design grid: 24x24 viewBox
// Stroke weight: 1.5px
// Line caps: round
// Line joins: round
// Built for the "active security and risk avoidance" voice — directional, dynamic, grounded.

interface IconProps {
  size?:   number
  color?:  string
  strokeWidth?: number
  className?: string
}

const baseProps = (size = 24, color = 'currentColor', strokeWidth = 1.5) => ({
  width:  size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

// ── ACTIVITY ICONS (4) ─────────────────────────────────────────

export function IconKayak({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Kayak silhouette with paddle */}
      <path d="M3 14 C5 16 9 17 12 17 C15 17 19 16 21 14"/>
      <path d="M3 14 C5 12 9 11 12 11 C15 11 19 12 21 14"/>
      <line x1="7" y1="6"  x2="17" y2="22"/>
      <line x1="5" y1="7"  x2="9"  y2="9"/>
      <line x1="15" y1="19" x2="19" y2="21"/>
    </svg>
  )
}

export function IconHike({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Mountain peaks with trail */}
      <path d="M3 20 L9 10 L13 16 L17 7 L21 20 Z"/>
      <path d="M3 20 L21 20"/>
      <circle cx="17" cy="7" r="1"/>
    </svg>
  )
}

export function IconATV({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* ATV silhouette */}
      <circle cx="6"  cy="17" r="2.5"/>
      <circle cx="18" cy="17" r="2.5"/>
      <path d="M6 17 L18 17"/>
      <path d="M4 13 L7 10 L17 10 L20 13"/>
      <path d="M9 10 L9 7 L15 7 L15 10"/>
      <line x1="11" y1="7" x2="13" y2="7"/>
    </svg>
  )
}

export function IconClimb({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Stylized climber + rope */}
      <circle cx="10" cy="5" r="2"/>
      <path d="M10 7 L10 11 L7 14"/>
      <path d="M10 11 L13 13 L11 17 L9 21"/>
      <path d="M13 13 L16 11"/>
      {/* Rope */}
      <path d="M16 4 C18 6 18 9 16 11" strokeDasharray="2 2"/>
    </svg>
  )
}

// ── STATUS ICONS (6) ───────────────────────────────────────────

export function IconSigned({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Document with checkmark */}
      <path d="M14 3 L6 3 C5 3 4 4 4 5 L4 19 C4 20 5 21 6 21 L18 21 C19 21 20 20 20 19 L20 9 Z"/>
      <path d="M14 3 L14 9 L20 9"/>
      <path d="M8 14 L10.5 16.5 L15 12"/>
    </svg>
  )
}

export function IconPending({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Document with clock */}
      <path d="M14 3 L6 3 C5 3 4 4 4 5 L4 19 C4 20 5 21 6 21 L18 21 C19 21 20 20 20 19 L20 9 Z"/>
      <path d="M14 3 L14 9 L20 9"/>
      <circle cx="12" cy="15" r="3"/>
      <path d="M12 13.5 L12 15 L13 16"/>
    </svg>
  )
}

export function IconException({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Triangle with exclamation */}
      <path d="M12 3 L21 19 L3 19 Z"/>
      <line x1="12" y1="10" x2="12" y2="14"/>
      <circle cx="12" cy="16.5" r="0.5" fill={color || 'currentColor'}/>
    </svg>
  )
}

export function IconLegalHold({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Lock with shield */}
      <path d="M12 3 L20 6 L20 12 C20 17 16 20 12 21 C8 20 4 17 4 12 L4 6 Z"/>
      <rect x="9" y="11" width="6" height="6" rx="1"/>
      <path d="M10.5 11 L10.5 9 C10.5 8 11 7 12 7 C13 7 13.5 8 13.5 9 L13.5 11"/>
    </svg>
  )
}

export function IconVerified({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Seal with checkmark — 8-point starburst */}
      <path d="M12 2 L13.5 4.5 L16.5 3.5 L17 6.5 L19.5 7 L18.5 10 L21 12 L18.5 14 L19.5 17 L17 17.5 L16.5 20.5 L13.5 19.5 L12 22 L10.5 19.5 L7.5 20.5 L7 17.5 L4.5 17 L5.5 14 L3 12 L5.5 10 L4.5 7 L7 6.5 L7.5 3.5 L10.5 4.5 Z"/>
      <path d="M8.5 12 L11 14.5 L15.5 10"/>
    </svg>
  )
}

export function IconRiskScore({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Gauge with needle */}
      <path d="M4 18 A8 8 0 0 1 20 18"/>
      <line x1="4"  y1="18" x2="3"  y2="18"/>
      <line x1="20" y1="18" x2="21" y2="18"/>
      <line x1="6.5" y1="11" x2="5.5" y2="10"/>
      <line x1="17.5" y1="11" x2="18.5" y2="10"/>
      <line x1="12" y1="8" x2="12" y2="6.5"/>
      {/* Needle */}
      <line x1="12" y1="18" x2="15" y2="12.5"/>
      <circle cx="12" cy="18" r="1" fill={color || 'currentColor'}/>
    </svg>
  )
}

// ── CAPABILITY ICONS (6) ───────────────────────────────────────

export function IconDocumentIntelligence({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Document with spark/intelligence indicator */}
      <path d="M14 3 L6 3 C5 3 4 4 4 5 L4 19 C4 20 5 21 6 21 L18 21 C19 21 20 20 20 19 L20 9 Z"/>
      <path d="M14 3 L14 9 L20 9"/>
      {/* Sparkle */}
      <path d="M11 13 L11 17 M9 15 L13 15"/>
      <circle cx="16" cy="14" r="0.5" fill={color || 'currentColor'}/>
      <circle cx="15" cy="17" r="0.5" fill={color || 'currentColor'}/>
    </svg>
  )
}

export function IconIdentityGraph({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Connected nodes — network */}
      <circle cx="12" cy="6"  r="2"/>
      <circle cx="5"  cy="17" r="2"/>
      <circle cx="19" cy="17" r="2"/>
      <circle cx="12" cy="13" r="1.5"/>
      <line x1="12" y1="8"  x2="12" y2="11.5"/>
      <line x1="11" y1="14" x2="6.5"  y2="16"/>
      <line x1="13" y1="14" x2="17.5" y2="16"/>
    </svg>
  )
}

export function IconRiskProfile({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Person silhouette with assessment bar */}
      <circle cx="12" cy="7" r="3"/>
      <path d="M5 21 C5 17 8 14 12 14 C16 14 19 17 19 21"/>
      <line x1="3" y1="3" x2="6" y2="3"/>
      <line x1="3" y1="6" x2="8" y2="6"/>
      <line x1="3" y1="9" x2="5" y2="9"/>
    </svg>
  )
}

export function IconAuditTrail({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* List with checkmarks — audit log */}
      <line x1="9" y1="6" x2="20" y2="6"/>
      <line x1="9" y1="12" x2="20" y2="12"/>
      <line x1="9" y1="18" x2="20" y2="18"/>
      <path d="M3 5 L4 6 L6 4"/>
      <path d="M3 11 L4 12 L6 10"/>
      <path d="M3 17 L4 18 L6 16"/>
    </svg>
  )
}

export function IconIntegration({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Two interlocking puzzle/plug shapes */}
      <path d="M3 10 L3 6 C3 5 4 4 5 4 L9 4 L9 7 C9 8 10 9 11 9 C12 9 13 8 13 7 L13 4 L17 4 C18 4 19 5 19 6 L19 10 L16 10 C15 10 14 11 14 12 C14 13 15 14 16 14 L19 14 L19 18 C19 19 18 20 17 20 L13 20 L13 17 C13 16 12 15 11 15 C10 15 9 16 9 17 L9 20 L5 20 C4 20 3 19 3 18 Z"/>
    </svg>
  )
}

export function IconNetwork({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      {/* Globe with intersection lines — network */}
      <circle cx="12" cy="12" r="9"/>
      <ellipse cx="12" cy="12" rx="4" ry="9"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <path d="M5 7 C8 9 16 9 19 7"/>
      <path d="M5 17 C8 15 16 15 19 17"/>
    </svg>
  )
}

// ── SIGNATURE SYMBOLS (4) ─────────────────────────────────────

// AI-Active mark — for moments when the AI is computing/inferring
export function IconAIActive({ size = 24, color = '#4B2ACF', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Compact sparkle/spark — fills with brand color */}
      <path d="M12 3 L13.5 9.5 L20 11 L13.5 12.5 L12 19 L10.5 12.5 L4 11 L10.5 9.5 Z" fill={color}/>
      <circle cx="18" cy="6"  r="1.2" fill={color} opacity="0.6"/>
      <circle cx="6"  cy="18" r="1"   fill={color} opacity="0.4"/>
    </svg>
  )
}

// Risk Score badge — circular badge frame for the score number
export function IconRiskBadge({ size = 24, color = '#EA580C', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.5"/>
      <path d="M12 6 L13 9 L16 9 L13.5 11 L14.5 14 L12 12.5 L9.5 14 L10.5 11 L8 9 L11 9 Z" fill={color}/>
    </svg>
  )
}

// LIABL Pass mark — refined ✦
export function IconLIABLPass({ size = 24, color = '#4B2ACF', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2 L13.5 9.5 L21 11 L13.5 12.5 L12 20 L10.5 12.5 L3 11 L10.5 9.5 Z" fill={color}/>
    </svg>
  )
}

// Verified Seal — for document-sealed moments
export function IconVerifiedSeal({ size = 24, color = '#15803D', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* 12-point starburst seal */}
      <path d="M12 2 L13.5 4.5 L16.5 3.5 L17 6.5 L19.5 7 L18.5 10 L21 12 L18.5 14 L19.5 17 L17 17.5 L16.5 20.5 L13.5 19.5 L12 22 L10.5 19.5 L7.5 20.5 L7 17.5 L4.5 17 L5.5 14 L3 12 L5.5 10 L4.5 7 L7 6.5 L7.5 3.5 L10.5 4.5 Z"
        fill={color}/>
      <path d="M8.5 12 L11 14.5 L15.5 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

// ── UI/NAV ICONS — added for v19 emoji sweep ─────────────────

export function IconAnalytics({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <line x1="4"  y1="20" x2="20" y2="20"/>
      <rect x="6"  y="13" width="3" height="7" rx="0.5"/>
      <rect x="11" y="9"  width="3" height="11" rx="0.5"/>
      <rect x="16" y="6"  width="3" height="14" rx="0.5"/>
    </svg>
  )
}

export function IconTemplate({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="9" x2="9" y2="21"/>
    </svg>
  )
}

export function IconAlert({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M12 2 C7 2 6 6 5 10 C4.5 12 3 14 3 16 L21 16 C21 14 19.5 12 19 10 C18 6 17 2 12 2 Z"/>
      <path d="M10 19 C10 20.5 11 22 12 22 C13 22 14 20.5 14 19"/>
    </svg>
  )
}

export function IconLocation({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M12 2 C8 2 5 5 5 9 C5 14 12 22 12 22 C12 22 19 14 19 9 C19 5 16 2 12 2 Z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  )
}

export function IconRocket({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M5 13 L5 18 L10 18"/>
      <path d="M11 18 L13 21 L18 18 C20 16 21 14 21 11 C21 6 17 3 12 3 C9 3 7 4 5 6 C5 6 9 6 11 8 C13 10 13 14 11 18 Z"/>
      <circle cx="14" cy="9" r="1.5"/>
    </svg>
  )
}

export function IconMobile({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <rect x="7" y="2" width="10" height="20" rx="2"/>
      <line x1="11" y1="18" x2="13" y2="18"/>
    </svg>
  )
}

export function IconUserGroup({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <circle cx="9" cy="8" r="3"/>
      <path d="M3 20 C3 16 6 14 9 14 C12 14 15 16 15 20"/>
      <circle cx="17" cy="9" r="2.5"/>
      <path d="M16 14 C19 14 21 16 21 19"/>
    </svg>
  )
}

export function IconCreditCard({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2"/>
      <line x1="3" y1="11" x2="21" y2="11"/>
      <line x1="7" y1="15" x2="9" y2="15"/>
    </svg>
  )
}

export function IconTrending({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M3 17 L9 11 L13 15 L21 7"/>
      <path d="M15 7 L21 7 L21 13"/>
    </svg>
  )
}

export function IconShield({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M12 3 L20 6 L20 12 C20 17 16 20 12 21 C8 20 4 17 4 12 L4 6 Z"/>
    </svg>
  )
}

export function IconUser({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21 C4 17 7 14 12 14 C17 14 20 17 20 21"/>
    </svg>
  )
}

export function IconPresentation({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <rect x="3" y="4" width="18" height="12" rx="2"/>
      <line x1="12" y1="16" x2="12" y2="20"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <path d="M7 12 L10 9 L13 11 L17 7"/>
    </svg>
  )
}

export function IconHeart({ size, color, strokeWidth, className }: IconProps) {
  return (
    <svg {...baseProps(size, color, strokeWidth)} className={className}>
      <path d="M12 21 C12 21 4 16 4 9 C4 6 6 4 9 4 C10.5 4 12 5 12 5 C12 5 13.5 4 15 4 C18 4 20 6 20 9 C20 16 12 21 12 21 Z"/>
    </svg>
  )
}

// ── Index export for design system / brand page ────────────────
export const ICON_LIBRARY = {
  activity: [
    { name:'Kayak',                       Component:IconKayak                 },
    { name:'Hike',                        Component:IconHike                  },
    { name:'ATV',                         Component:IconATV                   },
    { name:'Climb',                       Component:IconClimb                 },
  ],
  status: [
    { name:'Signed',                      Component:IconSigned                },
    { name:'Pending',                     Component:IconPending               },
    { name:'Exception',                   Component:IconException             },
    { name:'Legal Hold',                  Component:IconLegalHold             },
    { name:'Verified',                    Component:IconVerified              },
    { name:'Risk Score',                  Component:IconRiskScore             },
  ],
  capability: [
    { name:'Document Intelligence',       Component:IconDocumentIntelligence  },
    { name:'Identity Graph',              Component:IconIdentityGraph         },
    { name:'Risk Profile',                Component:IconRiskProfile           },
    { name:'Audit Trail',                 Component:IconAuditTrail            },
    { name:'Integration',                 Component:IconIntegration           },
    { name:'Network',                     Component:IconNetwork               },
  ],
  signature: [
    { name:'AI Active',                   Component:IconAIActive              },
    { name:'Risk Badge',                  Component:IconRiskBadge             },
    { name:'LIABL Pass',                  Component:IconLIABLPass             },
    { name:'Verified Seal',               Component:IconVerifiedSeal          },
  ],
}
