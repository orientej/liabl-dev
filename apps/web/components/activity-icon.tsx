// components/activity-icon.tsx
// v25 Milestone 4
//
// The one legitimate exception to "no hardcoded activity map" in this
// pass: activities.icon is a data string (e.g. 'kayak'), but the actual
// icon is a compiled React component — that can't be looked up from a
// database without a dynamic-import system, which is out of scope here.
// Adding a fifth activity means adding a row AND, if it needs a new
// icon, a matching entry below and a new icon component — a smaller
// touch than today's four-hardcoded-activities problem, not a full
// reversion to it.

import type { ComponentType } from 'react'
import { IconKayak, IconHike, IconATV, IconClimb, IconUser } from '@/components/icons'

export type ActivityIconComponent = ComponentType<{ size?: number; color?: string }>

const ACTIVITY_ICONS: Record<string, ActivityIconComponent> = {
  kayak: IconKayak,
  hike:  IconHike,
  atv:   IconATV,
  climb: IconClimb,
}

/** Falls back to a generic icon for any activity.icon value that doesn't
 * have a matching component yet, rather than rendering nothing. */
export function getActivityIcon(icon: string): ActivityIconComponent {
  return ACTIVITY_ICONS[icon] ?? IconUser
}
