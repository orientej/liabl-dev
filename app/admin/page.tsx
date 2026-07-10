'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageNav from '@/components/PageNav'
import AccountsTab from '@/components/admin/AccountsTab'
import UsersTab from '@/components/admin/UsersTab'
import ReportingTab from '@/components/admin/ReportingTab'
import SettingsTab from '@/components/admin/SettingsTab'
import { getCurrentAdmin } from '@/lib/admin-auth'
import { signOut } from '@/lib/auth'
import { IconUserGroup, IconAnalytics, IconTemplate, IconShield } from '@/components/icons'

type Tab = 'accounts' | 'users' | 'reporting' | 'settings'

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('accounts')
  const [adminEmail, setAdminEmail] = useState('Loading…')

  useEffect(() => {
    (async () => {
      const admin = await getCurrentAdmin()
      if (admin) {
        setAdminEmail(admin.email)
      } else {
        // Middleware already gates this route, but fail safe.
        router.replace('/admin/login')
      }
    })()
  }, [router])

  async function handleSignOut() {
    await signOut()
    window.location.href = '/admin/login'
  }

  const tabs: { key: Tab; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
    { key: 'accounts',  label: 'Accounts',  Icon: IconShield     },
    { key: 'users',     label: 'Users',     Icon: IconUserGroup  },
    { key: 'reporting', label: 'Reporting', Icon: IconAnalytics  },
    { key: 'settings',  label: 'Settings',  Icon: IconTemplate   },
  ]

  return (
    <div className="min-h-screen bg-surface">
      <PageNav badge="LIABL Admin" operatorName={adminEmail} operatorAccent="#DC2626" onSignOut={handleSignOut} homeHref="/admin" />

      <div className="bg-white border-b border-black/10 px-5 overflow-x-auto">
        <div className="flex gap-1 max-w-5xl mx-auto">
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === key ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-ink'
              }`}>
              <Icon size={16} color={tab === key ? '#DC2626' : '#9CA3AF'} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-8">
        {tab === 'accounts'  && <AccountsTab />}
        {tab === 'users'     && <UsersTab />}
        {tab === 'reporting' && <ReportingTab />}
        {tab === 'settings'  && <SettingsTab />}
      </div>
    </div>
  )
}
