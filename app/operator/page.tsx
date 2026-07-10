'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import PageNav from '@/components/PageNav'
import RosterTab        from '@/components/operator/RosterTab'
import TemplateTab      from '@/components/operator/TemplateTab'
import AnalyticsTab     from '@/components/operator/AnalyticsTab'
import IncidentTab      from '@/components/operator/IncidentTab'
import MobileTab        from '@/components/operator/MobileTab'
import NotificationTab  from '@/components/operator/NotificationTab'
import MultiLocationTab from '@/components/operator/MultiLocationTab'
import SettingsTab      from '@/components/operator/SettingsTab'
import SessionsTab      from '@/components/operator/SessionsTab'
import { getCurrentOperatorMember, signOut } from '@/lib/auth'
import { fetchBillingStatus, type BillingStatus } from '@/lib/billing'
import {
  IconSigned, IconAnalytics, IconTemplate, IconAlert,
  IconAuditTrail, IconLocation, IconMobile, IconUserGroup, IconRocket,
} from '@/components/icons'

type Tab = 'roster'|'analytics'|'templates'|'incidents'|'notifications'|'multilocation'|'mobile'|'settings'|'sessions'

export default function OperatorPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('roster')
  // Falls back to the old hardcoded name only for the brief window before
  // the real operator loads — middleware already guarantees someone is
  // logged in by the time this page renders, so this is a loading state,
  // not a permanent fallback.
  const [operatorName, setOperatorName] = useState('Loading…')
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [suspended, setSuspended] = useState(false)

  useEffect(() => {
    (async () => {
      const member = await getCurrentOperatorMember()
      if (member) {
        setOperatorName(member.operatorName)
        if (member.operatorStatus === 'suspended') {
          // Dedicated screen rather than letting every tab's own
          // fetchEngineData() call surface this as a scattered generic
          // load-error banner — a suspended account deserves one clear
          // message, not five confusing ones across five tabs.
          setSuspended(true)
          return
        }
        try {
          const { createClient } = await import('@/lib/supabase')
          setBilling(await fetchBillingStatus(createClient(), member.operatorId))
        } catch (e) {
          // Non-fatal — the dashboard works fine without the usage
          // banner, and this is a soft-block feature, not a gate.
          console.error('[OperatorPage] billing status load failed:', e)
        }
      } else {
        // Shouldn't happen — middleware already gates this route — but
        // fail safe by sending back to login rather than showing a
        // dashboard with no known operator.
        router.replace('/operator/login')
      }
    })()
  }, [router])

  async function handleSignOut() {
    await signOut()
    router.replace('/operator/login')
  }

  const tabs: { key:Tab; label:string; Icon: React.ComponentType<{size?:number;color?:string}> }[] = [
    { key:'sessions',      label:'Sessions',       Icon: IconRocket     },
    { key:'roster',        label:'Roster',         Icon: IconSigned     },
    { key:'analytics',     label:'Analytics',      Icon: IconAnalytics  },
    { key:'templates',     label:'Templates',      Icon: IconTemplate   },
    { key:'incidents',     label:'Incidents',      Icon: IconAlert      },
    { key:'notifications', label:'Notifications',  Icon: IconAuditTrail },
    { key:'multilocation', label:'Multi-Location', Icon: IconLocation   },
    { key:'mobile',        label:'Mobile App',     Icon: IconMobile     },
    { key:'settings',      label:'Settings',       Icon: IconUserGroup  },
  ]

  if (suspended) {
    return (
      <div className="min-h-screen bg-surface">
        <PageNav badge="Operator" operatorName={operatorName} operatorAccent="#4B2ACF" onSignOut={handleSignOut} />
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <h1 className="font-serif text-2xl mb-3" style={{ letterSpacing:'-0.01em' }}>Account suspended</h1>
          <p className="text-sm text-gray-500">
            {operatorName}&apos;s account is currently suspended. Contact LIABL support to resolve this and restore access.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <PageNav badge="Operator" operatorName={operatorName} operatorAccent="#4B2ACF" onSignOut={handleSignOut} />

      {/* Usage banner — soft block by design: signing is never
          interrupted by this, it's purely a visible staff alert,
          matching the corrected (no-longer-false) notification copy
          in 013_m5_billing.sql. Shown at 85%+, same threshold as the
          notification trigger, so the two stay consistent. */}
      {billing && billing.percentUsed >= 85 && (
        <div className={`px-5 py-2.5 text-sm text-center font-medium ${
          billing.percentUsed >= 100 ? 'bg-red-50 text-red-700 border-b border-red-200' : 'bg-amber-50 text-amber-700 border-b border-amber-200'
        }`}>
          {billing.percentUsed >= 100
            ? `You've used ${billing.used} of ${billing.limit} signatures for ${billing.periodLabel} — over your plan limit. Signing still works uninterrupted; `
            : `${billing.used} of ${billing.limit} signatures used for ${billing.periodLabel} (${billing.percentUsed}%). `
          }
          <a href="/pricing" className="underline font-semibold">
            {billing.percentUsed >= 100 ? 'contact us to upgrade' : 'view upgrade options'}
          </a>
        </div>
      )}

      <div className="bg-white border-b border-black/10 px-5 overflow-x-auto">
        <div className="flex gap-0 max-w-4xl mx-auto min-w-max">
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap inline-flex items-center gap-2 ${
                tab === key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-ink'
              }`}>
              <Icon size={16}/>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {tab === 'roster'        && <RosterTab />}
        {tab === 'analytics'     && <AnalyticsTab />}
        {tab === 'templates'     && <TemplateTab />}
        {tab === 'incidents'     && <IncidentTab />}
        {tab === 'notifications' && <NotificationTab />}
        {tab === 'multilocation' && <MultiLocationTab />}
        {tab === 'mobile'        && <MobileTab />}
        {tab === 'settings'      && <SettingsTab onNavigateToSessions={() => setTab('sessions')} />}
        {tab === 'sessions'      && <SessionsTab />}
      </div>
    </div>
  )
}
