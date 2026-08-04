'use client'
// Operator console — grouped, collapsible left navigation. Replaces the old
// horizontal tab bar. Every destination is still a tab the parent page renders;
// this component only reorganizes how they're grouped and selected. Groups fold;
// Notifications moved to a top-bar bell and "Get started" to the footer.
import { useState } from 'react'
import { ChevronDown, X, LayoutGrid } from 'lucide-react'
import {
  IconSigned, IconAnalytics, IconTemplate, IconAlert, IconAuditTrail,
  IconLocation, IconMobile, IconUserGroup, IconRocket, IconVerified,
} from '@liabl/ui'

export type OperatorTab =
  | 'dashboard' | 'setup' | 'roster' | 'analytics' | 'templates' | 'documents' | 'reservations'
  | 'incidents' | 'notifications' | 'multilocation' | 'mobile' | 'settings'
  | 'sessions' | 'developers' | 'branding' | 'marketing' | 'billing'

type IconCmp = React.ComponentType<{ size?: number; color?: string }>
interface NavItem { key: OperatorTab; label: string; Icon: IconCmp }
interface NavGroup { title: string; items: NavItem[] }

// Human labels for every tab (used by the parent's top-bar breadcrumb too).
export const TAB_LABELS: Record<OperatorTab, string> = {
  dashboard: 'Dashboard',
  setup: 'Get started', roster: 'Roster', analytics: 'Analytics', templates: 'Templates',
  documents: 'Signed documents', reservations: 'Reservations', incidents: 'Incidents',
  notifications: 'Notifications', multilocation: 'Locations', mobile: 'Mobile app',
  settings: 'General settings', sessions: 'Sessions', developers: 'Developers',
  branding: 'Branding', marketing: 'Marketing', billing: 'Billing & payments',
}

const GROUPS: NavGroup[] = [
  { title: 'Operations', items: [
    { key: 'sessions',     label: 'Sessions',     Icon: IconRocket },
    { key: 'roster',       label: 'Roster',       Icon: IconSigned },
    { key: 'reservations', label: 'Reservations', Icon: IconUserGroup },
    { key: 'incidents',    label: 'Incidents',    Icon: IconAlert },
  ]},
  { title: 'Waivers', items: [
    { key: 'templates',    label: 'Templates',         Icon: IconTemplate },
    { key: 'documents',    label: 'Signed documents',  Icon: IconSigned },
  ]},
  { title: 'Growth', items: [
    { key: 'analytics',    label: 'Analytics',    Icon: IconAnalytics },
    { key: 'marketing',    label: 'Marketing',    Icon: IconAuditTrail },
  ]},
]

const BILLING_ITEM: NavItem = { key: 'billing', label: 'Billing & payments', Icon: IconVerified }

const SETTINGS_GROUP: NavGroup = { title: 'Settings', items: [
  { key: 'settings',      label: 'General',    Icon: IconUserGroup },
  { key: 'branding',      label: 'Branding',   Icon: IconTemplate },
  { key: 'multilocation', label: 'Locations',  Icon: IconLocation },
  { key: 'mobile',        label: 'Mobile app', Icon: IconMobile },
  { key: 'developers',    label: 'Developers', Icon: IconRocket },
]}

const SETUP_ITEM: NavItem = { key: 'setup', label: 'Get started', Icon: IconVerified }

// Pinned above every group — the operator's landing page. lucide's `size` type
// is `number | string`, wider than our IconCmp's `number`; a thin wrapper keeps
// the icon prop contract uniform with the @liabl/ui icons.
const DashboardIcon: IconCmp = ({ size, color }) => <LayoutGrid size={size} color={color} />
const DASHBOARD_ITEM: NavItem = { key: 'dashboard', label: 'Dashboard', Icon: DashboardIcon }

export default function OperatorSidebar({ tab, onSelect, operatorName, open, onClose }: {
  tab: OperatorTab
  onSelect: (t: OperatorTab) => void
  operatorName: string
  open: boolean
  onClose: () => void
}) {
  // Settings is the only group folded by default (rarely-touched config).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ Settings: true })
  const toggleGroup = (title: string) => setCollapsed(c => ({ ...c, [title]: !c[title] }))

  const Item = ({ item }: { item: NavItem }) => {
    const active = tab === item.key
    return (
      <button onClick={() => onSelect(item.key)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${
          active ? 'bg-brand/10 text-brand font-semibold' : 'text-gray-600 hover:bg-surface'
        }`}>
        <item.Icon size={16} color={active ? '#4B2ACF' : '#6B7280'} />
        <span className="truncate">{item.label}</span>
      </button>
    )
  }

  const Group = ({ group }: { group: NavGroup }) => {
    const isCollapsed = !!collapsed[group.title]
    return (
      <div className="mt-3">
        <button onClick={() => toggleGroup(group.title)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600">
          <span>{group.title}</span>
          <ChevronDown size={12} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
        </button>
        {!isCollapsed && (
          <div className="pl-1 space-y-0.5">
            {group.items.map(item => <Item key={item.key} item={item} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-white border-r border-black/10 flex flex-col transition-transform lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-black/5">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center shrink-0">
            <svg width="17" height="17" viewBox="0 0 512 512" aria-hidden="true"><path d="M256 96 L299 213 L416 256 L299 299 L256 416 L213 299 L96 256 L213 213 Z" fill="#fff"/></svg>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight">LIABL</div>
            <div className="text-[11px] text-gray-400 truncate">{operatorName}</div>
          </div>
          <button className="ml-auto lg:hidden text-gray-400 hover:text-ink" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5">
          <Item item={DASHBOARD_ITEM} />
          {GROUPS.map(g => <Group key={g.title} group={g} />)}
          <div className="mt-3"><Item item={BILLING_ITEM} /></div>
          <Group group={SETTINGS_GROUP} />
        </nav>

        <div className="border-t border-black/5 p-2.5">
          <Item item={SETUP_ITEM} />
        </div>
      </aside>
    </>
  )
}
