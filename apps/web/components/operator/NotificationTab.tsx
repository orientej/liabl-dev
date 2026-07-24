'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  listNotifications, markRead, markAllRead,
  type NotificationRecord, type NotifType,
} from '@/lib/notifications'
import {
  IconSigned, IconException, IconLegalHold, IconNetwork,
  IconVerified, IconAnalytics, IconLIABLPass, IconAlert, IconTemplate,
} from '@liabl/ui'

// ── Display config — identical to the original, keeps visual parity ───────────

const TYPE_CONFIG: Record<NotifType, {
  Icon: React.ComponentType<{size?:number; color?:string}>
  color: string; bg: string; label: string; iconColor: string
}> = {
  waiver_signed:    { Icon:IconSigned,    color:'text-emerald-700', bg:'bg-emerald-50', label:'Waiver signed',    iconColor:'#15803D' },
  exception_flagged:{ Icon:IconException, color:'text-amber-700',   bg:'bg-amber-50',   label:'Exception',        iconColor:'#D97706' },
  legal_hold:       { Icon:IconLegalHold, color:'text-red-700',     bg:'bg-red-50',     label:'Legal hold',       iconColor:'#DC2626' },
  carrier_notified: { Icon:IconNetwork,   color:'text-blue-700',    bg:'bg-blue-50',    label:'Carrier notified', iconColor:'#2563EB' },
  group_complete:   { Icon:IconVerified,  color:'text-emerald-700', bg:'bg-emerald-50', label:'Group complete',   iconColor:'#15803D' },
  overage_warning:  { Icon:IconAnalytics, color:'text-orange-700',  bg:'bg-orange-50',  label:'Usage alert',      iconColor:'#EA580C' },
  pass_recognized:  { Icon:IconLIABLPass, color:'text-brand',       bg:'bg-brand/10',   label:'Returning',        iconColor:'#4B2ACF' },
}

type Filter = 'all' | 'unread' | 'high'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  1) return 'Just now'
  if (mins  < 60) return `${mins} min ago`
  if (hours < 24) return `${hours} hr ago`
  if (days  <  2) return 'Yesterday'
  return `${days} days ago`
}

export default function NotificationTab() {
  const [notifs,    setNotifs]    = useState<NotificationRecord[]>([])
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [filter,    setFilter]    = useState<Filter>('all')
  const [allReadConfirm, setAllReadConfirm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    const rows = await listNotifications(50)
    // listNotifications returns [] on error and logs internally;
    // we treat an empty response after loading as either "no notifications
    // yet" or a load error — distinguish by catching thrown errors
    setNotifs(rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    load().catch(() => {
      setLoadError(true)
      setLoading(false)
    })
  }, [load])

  const unreadCount = notifs.filter(n => !n.read).length
  const highCount   = notifs.filter(n => n.priority === 'high' && !n.read).length

  async function handleMarkRead(id: string) {
    // Optimistic update — flip locally immediately, persist in background
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await markRead(id)
  }

  async function handleMarkAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setAllReadConfirm(true)
    setTimeout(() => setAllReadConfirm(false), 3000)
    await markAllRead()
  }

  const visible = notifs.filter(n =>
    filter === 'unread' ? !n.read :
    filter === 'high'   ? n.priority === 'high' : true
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="font-serif text-2xl" style={{ letterSpacing:'-0.01em' }}>Notifications</h1>
          <p className="text-sm text-gray-400 mt-1">
            Desert Ridge Adventures ·{' '}
            {loading ? (
              <span>Loading…</span>
            ) : unreadCount > 0 ? (
              <span className="text-brand font-medium">{unreadCount} unread</span>
            ) : (
              'All caught up'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="text-xs px-3 py-2 rounded-xl border border-black/20 text-gray-500 hover:bg-surface transition-colors"
            title="Refresh notifications"
          >
            ↻ Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className={`text-sm px-4 py-2 rounded-xl border transition-all ${
                allReadConfirm
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white border-black/20 text-gray-600 hover:bg-surface'
              }`}
            >
              {allReadConfirm ? '✓ All marked read' : 'Mark all as read'}
            </button>
          )}
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>Couldn't load notifications.</span>
          <button onClick={load} className="underline ml-1">Try again</button>
        </div>
      )}

      {/* High-priority alert banner */}
      {!loading && highCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <IconAlert size={20} color="#DC2626" />
          <div className="flex-1">
            <div className="font-semibold text-red-700 text-sm mb-1">
              {highCount} high-priority alert{highCount > 1 ? 's' : ''} require your attention
            </div>
            <div className="text-xs text-red-600 leading-relaxed">
              {notifs
                .filter(n => n.priority === 'high' && !n.read)
                .map(n => n.title)
                .join(' · ')}
            </div>
          </div>
          <button
            onClick={() => setFilter('high')}
            className="text-xs text-red-700 underline shrink-0 hover:opacity-70"
          >
            View all
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 mb-5 w-fit">
        {([
          { key:'all',    label:`All (${notifs.length})`                                          },
          { key:'unread', label:`Unread (${unreadCount})`                                         },
          { key:'high',   label:`High priority (${notifs.filter(n => n.priority === 'high').length})` },
        ] as { key:Filter; label:string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              filter === key ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-ink'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-black/10 p-10 text-center text-sm text-gray-400">
          Loading notifications…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-black/10 p-12 text-center">
          <div className="flex justify-center mb-3"><IconVerified size={40} color="#15803D" /></div>
          <div className="font-semibold text-ink mb-1">All caught up</div>
          <div className="text-sm text-gray-400">
            No {filter !== 'all' ? filter + ' ' : ''}notifications to show.
            {filter === 'all' && notifs.length === 0 && (
              <span className="block mt-1 text-xs">
                Notifications are generated automatically as participants sign waivers and incidents are filed.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(n => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG['waiver_signed']
            return (
              <div
                key={n.id}
                onClick={() => handleMarkRead(n.id)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-sm ${
                  n.read ? 'border-black/10' : 'border-brand/30 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <cfg.Icon size={18} color={cfg.iconColor} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-ink">{n.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {n.priority === 'high' && !n.read && (
                          <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                            High priority
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{relativeTime(n.createdAt)}</span>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-brand shrink-0" />}
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 leading-relaxed mb-2">{n.body}</p>

                    {n.link && (
                      <a
                        href={n.link}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-brand underline hover:opacity-70 transition-opacity"
                      >
                        {n.linkLabel ?? 'View'} →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Settings callout — unchanged from original */}
      <div className="mt-6 bg-surface border border-black/10 rounded-xl p-4 flex items-start gap-3">
        <IconTemplate size={20} color="#6B7280" />
        <div className="flex-1">
          <div className="text-sm font-medium text-ink mb-1">Notification preferences</div>
          <div className="text-xs text-gray-500 leading-relaxed">
            Configure which events trigger notifications, delivery method (in-app, email, SMS),
            and escalation rules for unresolved high-priority alerts.
          </div>
        </div>
        <button className="text-xs text-brand underline shrink-0 hover:opacity-70">Configure</button>
      </div>
    </div>
  )
}
