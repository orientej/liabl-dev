'use client'
import { useState } from 'react'
import Logo from '@/components/Logo'
import PageNav from '@/components/PageNav'
import RosterTab        from '@/components/operator/RosterTab'
import TemplateTab      from '@/components/operator/TemplateTab'
import AnalyticsTab     from '@/components/operator/AnalyticsTab'
import IncidentTab      from '@/components/operator/IncidentTab'
import MobileTab        from '@/components/operator/MobileTab'
import NotificationTab  from '@/components/operator/NotificationTab'
import MultiLocationTab from '@/components/operator/MultiLocationTab'
import {
  IconSigned, IconAnalytics, IconTemplate, IconAlert,
  IconAuditTrail, IconLocation, IconMobile,
} from '@/components/icons'

type Tab = 'roster'|'analytics'|'templates'|'incidents'|'notifications'|'multilocation'|'mobile'

export default function OperatorPage() {
  const [tab, setTab] = useState<Tab>('roster')

  const tabs: { key:Tab; label:string; Icon: React.ComponentType<{size?:number;color?:string}> }[] = [
    { key:'roster',        label:'Roster',         Icon: IconSigned     },
    { key:'analytics',     label:'Analytics',      Icon: IconAnalytics  },
    { key:'templates',     label:'Templates',      Icon: IconTemplate   },
    { key:'incidents',     label:'Incidents',      Icon: IconAlert      },
    { key:'notifications', label:'Notifications',  Icon: IconAuditTrail },
    { key:'multilocation', label:'Multi-Location', Icon: IconLocation   },
    { key:'mobile',        label:'Mobile App',     Icon: IconMobile     },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <PageNav badge="Operator" operatorName="Desert Ridge Adventures" operatorAccent="#4B2ACF" />
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
      </div>
    </div>
  )
}
