'use client'
// Operator console — dashboard landing. An at-a-glance operational + business
// overview: today's check-ins, what needs attention, and where the month
// stands. Every widget is best-effort (its own catch) so one failing query
// never blanks the page, and each panel deep-links into the relevant section.
import { useState, useEffect, useCallback } from 'react'
import { getCurrentOperatorMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { fetchBillingStatus, type BillingStatus } from '@/lib/billing'
import { fetchPayments, type PaymentsView } from '@/lib/billing-client'
import { formatMoney } from '@/lib/payments-client'
import { fetchAnalytics, type DailyPoint } from '@/lib/analytics'
import { listSessions } from '@/lib/sessions'
import { listMarketingContacts } from '@/lib/marketing-client'
import { fetchEngineData } from '@/lib/document-engine'
import type { OperatorTab } from '@/components/operator/OperatorSidebar'

interface TodaySession { id: string; ref: string; time: string | null; label: string; signed: number; total: number }
interface Activity { title: string; when: string }
interface AttnItem { tone: 'bad' | 'warn' | 'info'; title: string; detail: string }

interface DashData {
  billing: BillingStatus | null
  revenueCents: number
  checkinsToday: number
  pending: number
  trend: DailyPoint[]
  todaySessions: TodaySession[]
  attention: AttnItem[]
  recent: Activity[]
  marketing: { email: number; sms: number; enabled: boolean } | null
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DashboardTab({ onNavigate }: { onNavigate: (tab: OperatorTab) => void }) {
  const [name, setName] = useState('')
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) { setLoading(false); return }
      setName(member.operatorName)
      const operatorId = member.operatorId
      const supabase = createClient()
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayISO = isoDate(now)

      const num = (p: PromiseLike<{ count: number | null }>) => Promise.resolve(p).then(r => r.count ?? 0).catch(() => 0)

      const [billing, payments, analytics, checkinsToday, pendingRows, sealErrors, openIncidents, sessions, notifs, contacts, engine] = await Promise.all([
        fetchBillingStatus(supabase, operatorId).catch(() => null),
        fetchPayments(operatorId).catch((): PaymentsView | null => null),
        fetchAnalytics('week').catch(() => null),
        num(supabase.from('waivers').select('id', { count: 'exact', head: true }).eq('operator_id', operatorId).neq('mode', 'test').not('signed_at', 'is', null).gte('signed_at', todayStart.toISOString())),
        Promise.resolve(supabase.from('waivers').select('session_id').eq('operator_id', operatorId).neq('mode', 'test').is('signed_at', null)).then(r => r.data ?? []).catch(() => [] as { session_id: string | null }[]),
        num(supabase.from('waivers').select('id', { count: 'exact', head: true }).eq('operator_id', operatorId).neq('mode', 'test').not('seal_error', 'is', null)),
        num(supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'open')),
        listSessions(operatorId).catch(() => []),
        Promise.resolve(supabase.from('notifications').select('type, title, created_at').eq('operator_id', operatorId).order('created_at', { ascending: false }).limit(6)).then(r => r.data ?? []).catch(() => [] as { type: string; title: string; created_at: string }[]),
        listMarketingContacts(operatorId).catch(() => []),
        fetchEngineData(supabase).catch(() => null),
      ])

      // Pending signatures per session (for today's session progress + KPI).
      const pendingBySession = new Map<string, number>()
      for (const w of pendingRows) if (w.session_id) pendingBySession.set(w.session_id, (pendingBySession.get(w.session_id) ?? 0) + 1)
      const pending = pendingRows.length

      const labelFor = (key: string) => engine?.activities.find(a => a.key === key)?.displayName ?? key
      const todaySessions: TodaySession[] = sessions
        .filter(s => s.sessionDate === todayISO)
        .map(s => {
          const signed = s.waiverCount
          const total = signed + (pendingBySession.get(s.id) ?? 0)
          return { id: s.id, ref: s.sessionRef, time: s.sessionTime, label: labelFor(s.activityKey), signed, total }
        })

      // Needs-attention list (reserved status colors, always with a label).
      const attention: AttnItem[] = []
      if (openIncidents > 0) attention.push({ tone: 'bad', title: `${openIncidents} open incident${openIncidents === 1 ? '' : 's'}`, detail: 'Review and resolve in Incidents.' })
      if (billing && billing.percentUsed >= 85) attention.push({ tone: 'warn', title: 'Approaching plan limit', detail: `${billing.used} of ${billing.limit} signatures used (${billing.percentUsed}%).` })
      if (sealErrors > 0) attention.push({ tone: 'warn', title: `${sealErrors} waiver${sealErrors === 1 ? '' : 's'} failed to seal`, detail: 'The signature is recorded; sealing can be retried.' })
      if (pending > 0) attention.push({ tone: 'info', title: `${pending} pending signature${pending === 1 ? '' : 's'}`, detail: 'Participants added but not yet signed.' })

      const recent: Activity[] = notifs.map(n => ({ title: n.title, when: relTime(n.created_at) }))

      const marketing = engine?.marketingEnabled
        ? {
            email: contacts.filter(c => c.emailConsent && !c.unsubscribedEmail).length,
            sms: contacts.filter(c => c.smsConsent && !c.unsubscribedSms).length,
            enabled: true,
          }
        : null

      setData({
        billing,
        revenueCents: payments?.mtdCents ?? 0,
        checkinsToday,
        pending,
        trend: (analytics?.charts.trend ?? []).slice(-7),
        todaySessions,
        attention,
        recent,
        marketing,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-sm text-gray-500">Loading dashboard…</div>
  if (!data) return <div className="text-sm text-gray-500">Couldn’t load the dashboard.</div>

  const { billing } = data
  const usagePct = billing?.percentUsed ?? 0
  const trendMax = Math.max(1, ...data.trend.map(t => t.value))
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      {/* Header + quick actions */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>{greeting()}, {name || 'there'}</h1>
          <div className="text-sm text-gray-500">{today}{data.todaySessions.length > 0 ? ` · ${data.todaySessions.length} session${data.todaySessions.length === 1 ? '' : 's'} today` : ''}</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onNavigate('marketing')} className="btn-secondary text-sm">New broadcast</button>
          <button onClick={() => onNavigate('sessions')} className="btn-primary text-sm">+ New session</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Check-ins today</div>
          <div className="text-3xl font-bold mt-1.5" style={{ letterSpacing: '-0.02em' }}>{data.checkinsToday}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Pending signatures</div>
          <div className="text-3xl font-bold mt-1.5" style={{ letterSpacing: '-0.02em' }}>{data.pending}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Signatures this month</div>
          <div className="text-3xl font-bold mt-1.5" style={{ letterSpacing: '-0.02em' }}>
            {billing ? billing.used : '—'} <span className="text-base text-gray-400 font-semibold">/ {billing ? billing.limit : '—'}</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/5 overflow-hidden mt-2.5">
            <div className={`h-full ${usagePct >= 100 ? 'bg-red-500' : usagePct >= 85 ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${Math.min(100, usagePct)}%` }} />
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Revenue this month</div>
          <div className="text-3xl font-bold mt-1.5" style={{ letterSpacing: '-0.02em' }}>{formatMoney(data.revenueCents)}</div>
          <div className="text-xs text-gray-400 mt-1">in-person check-in payments</div>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-[1.55fr_1fr] gap-4">
        {/* Left */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-ink">Today’s sessions</h3>
              <button onClick={() => onNavigate('sessions')} className="text-xs text-brand font-semibold">All sessions →</button>
            </div>
            {data.todaySessions.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">No sessions scheduled today.</div>
            ) : data.todaySessions.map(s => {
              const pct = s.total > 0 ? Math.round((s.signed / s.total) * 100) : 100
              const done = s.total > 0 && s.signed >= s.total
              return (
                <div key={s.id} className="flex items-center gap-3 py-2.5 border-t border-black/5 first:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink truncate">{s.label}</div>
                    <div className="text-xs text-gray-400">{s.ref || '—'}{s.time ? ` · ${s.time}` : ''}</div>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="text-xs text-gray-500 mb-1">{s.signed} of {s.total} signed</div>
                    <div className="h-1.5 rounded-full bg-black/5 overflow-hidden"><div className={`h-full ${done ? 'bg-green-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 shrink-0 ${done ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                    {done ? 'Complete' : `${s.total - s.signed} pending`}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-ink">Check-ins — last 7 days</h3>
              <button onClick={() => onNavigate('analytics')} className="text-xs text-brand font-semibold">Analytics →</button>
            </div>
            {data.trend.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">No check-ins yet.</div>
            ) : (
              <div className="flex items-end gap-2" style={{ height: 96 }}>
                {data.trend.map((p, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 justify-end h-full">
                    <div className="w-full max-w-[26px] rounded-t bg-brand" style={{ height: `${Math.max(3, (p.value / trendMax) * 100)}%` }} title={`${p.value}`} />
                    <div className="text-[10px] text-gray-400">{p.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-medium text-ink mb-3">Needs attention</h3>
            {data.attention.length === 0 ? (
              <div className="text-sm text-green-600">✓ All clear — nothing needs your attention.</div>
            ) : data.attention.map((a, i) => (
              <div key={i} className="flex gap-2.5 py-2 border-t border-black/5 first:border-0">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.tone === 'bad' ? 'bg-red-500' : a.tone === 'warn' ? 'bg-amber-500' : 'bg-brand'}`} />
                <div><div className="text-sm font-medium text-ink">{a.title}</div><div className="text-xs text-gray-500">{a.detail}</div></div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-ink">Recent activity</h3>
              <button onClick={() => onNavigate('notifications')} className="text-xs text-brand font-semibold">View all →</button>
            </div>
            {data.recent.length === 0 ? (
              <div className="text-sm text-gray-400">Nothing yet.</div>
            ) : data.recent.map((r, i) => (
              <div key={i} className="flex gap-2 items-center py-2 border-t border-black/5 first:border-0 text-sm">
                <span className="text-ink truncate">{r.title}</span>
                <span className="ml-auto text-[11px] text-gray-400 whitespace-nowrap">{r.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: plan + marketing */}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-ink">Plan &amp; usage</h3>
            <button onClick={() => onNavigate('billing')} className="text-xs text-brand font-semibold">Manage billing →</button>
          </div>
          {billing ? (
            <>
              <div className="text-xs text-gray-500 mb-2">{billing.used} of {billing.limit} monthly signatures · {billing.periodLabel}</div>
              <div className="h-2 rounded-full bg-black/5 overflow-hidden"><div className={`h-full ${usagePct >= 100 ? 'bg-red-500' : usagePct >= 85 ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${Math.min(100, usagePct)}%` }} /></div>
              <div className="text-xs text-gray-400 mt-2">{Math.max(0, billing.limit - billing.used)} left this cycle.{usagePct >= 85 ? ' Approaching your limit — consider upgrading.' : ''}</div>
            </>
          ) : <div className="text-sm text-gray-400">Usage unavailable.</div>}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-ink">Marketing</h3>
            <button onClick={() => onNavigate('marketing')} className="text-xs text-brand font-semibold">Open marketing →</button>
          </div>
          {data.marketing ? (
            <div className="flex gap-6">
              <div><div className="text-2xl font-bold text-ink">{data.marketing.email.toLocaleString()}</div><div className="text-xs text-gray-400">email subscribers</div></div>
              <div><div className="text-2xl font-bold text-ink">{data.marketing.sms.toLocaleString()}</div><div className="text-xs text-gray-400">SMS subscribers</div></div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">Marketing is off. <button onClick={() => onNavigate('marketing')} className="text-brand font-medium">Turn it on →</button></div>
          )}
        </div>
      </div>
    </div>
  )
}
