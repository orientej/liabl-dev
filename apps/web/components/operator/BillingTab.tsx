'use client'
// Stripe payments — S1 console. Shows the operator's current plan + this
// month's signature usage, and hands off to Stripe-hosted Checkout (upgrade)
// and the Customer Portal (manage/cancel). No card data ever touches this UI.
import { useState, useEffect, useCallback } from 'react'
import { getCurrentOperatorMember } from '@/lib/auth'
import { createClient } from '@/lib/supabase'
import { fetchBillingStatus, type BillingStatus } from '@/lib/billing'
import {
  PLAN_CATALOG, planDisplay, openBillingPortal, fetchOperatorBilling,
  connectOnboard, fetchConnectStatus, type ConnectStatus,
} from '@/lib/billing-client'
import SubscribeDialog from '@/components/operator/SubscribeDialog'

const BLANK_CONNECT: ConnectStatus = { accountId: null, chargesEnabled: false, payoutsEnabled: false, onboarded: false }

export default function BillingTab() {
  const [operatorId, setOperatorId] = useState<string | null>(null)
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [planKey, setPlanKey] = useState<string>('free')
  const [hasCustomer, setHasCustomer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState<{ plan: 'connected' | 'pro'; label: string } | null>(null)
  const [connect, setConnect] = useState<ConnectStatus>(BLANK_CONNECT)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const member = await getCurrentOperatorMember()
      if (!member) throw new Error('No operator account for your login.')
      setOperatorId(member.operatorId)
      const [st, billing] = await Promise.all([
        fetchBillingStatus(createClient(), member.operatorId),
        fetchOperatorBilling(member.operatorId),
      ])
      setStatus(st); setPlanKey(billing.planKey); setHasCustomer(billing.hasCustomer); setConnect(billing.connect)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Reflect the ?billing=success|cancelled hand-back from Stripe, and force a
  // Connect status refresh when returning from onboarding (?connect=return).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const b = params.get('billing')
    if (b === 'success') setNote('Thanks! Your subscription is being activated — it may take a moment to reflect here.')
    else if (b === 'cancelled') setNote('Checkout cancelled — no changes were made.')
    if (params.get('connect') === 'return') { fetchConnectStatus().then(s => setConnect(s)).catch(() => {}) }
  }, [])

  async function setUpPayments() {
    setBusy('connect'); setError(null)
    try { await connectOnboard() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start onboarding'); setBusy(null) }
  }
  async function refreshConnect() {
    setBusy('connect-refresh'); setError(null)
    try { setConnect(await fetchConnectStatus()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh status') }
    finally { setBusy(null) }
  }

  function onSubscribed() {
    setSubscribing(null)
    setNote('Payment received — activating your subscription. This updates in a moment.')
    // The plan flips via the Stripe webhook; give it a beat, then refresh.
    setTimeout(() => { refresh() }, 2500)
  }
  async function manage() {
    setBusy('portal'); setError(null)
    try { await openBillingPortal() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open billing portal'); setBusy(null) }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading billing…</div>

  const current = planDisplay(planKey)
  const subscribed = current.key !== 'free'
  const pct = status?.percentUsed ?? 0
  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 85 ? 'bg-amber-500' : 'bg-brand'

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1" style={{ letterSpacing: '-0.01em' }}>Billing &amp; plan</h2>
        <p className="text-sm text-gray-500">Manage your subscription. Payments and cards are handled securely by Stripe.</p>
      </div>

      {note && <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl p-3 text-sm">{note}</div>}
      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}

      <div className="card mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Current plan</div>
            <div className="text-xl font-medium text-ink">{current.display}</div>
          </div>
          {hasCustomer && (
            <button onClick={manage} disabled={busy !== null} className="btn-secondary text-sm shrink-0">
              {busy === 'portal' ? 'Opening…' : 'Manage billing'}
            </button>
          )}
        </div>
        {status && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{status.used} of {status.limit} signatures · {status.periodLabel}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/5 overflow-hidden">
              <div className={`h-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            {pct >= 100 && <p className="text-xs text-red-600 mt-2">Over your plan limit — signing continues uninterrupted. Upgrade for more headroom.</p>}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {PLAN_CATALOG.map(plan => {
          const isCurrent = plan.key === current.key
          return (
            <div key={plan.key} className={`card ${isCurrent ? 'border-brand' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-ink">{plan.display}</h3>
                {isCurrent && <span className="text-[10px] uppercase border border-brand text-brand rounded px-1.5 py-0.5">Current</span>}
              </div>
              <p className="text-xs text-gray-500 mb-2">{plan.blurb}</p>
              <div className="text-sm text-ink mb-4">{plan.signatureLimit.toLocaleString()} signatures / mo</div>

              {isCurrent && <p className="text-xs text-gray-400">Your active plan.</p>}

              {/* On a paid plan already → changes go through the Customer Portal. */}
              {!isCurrent && plan.paid && subscribed && (
                <button onClick={manage} disabled={busy !== null} className="btn-secondary text-sm w-full">
                  {busy === 'portal' ? 'Opening…' : `Change to ${plan.display} in Manage billing`}
                </button>
              )}

              {/* Not subscribed yet → subscribe in-app via the Payment Element. */}
              {!isCurrent && plan.paid && !subscribed && (
                <button onClick={() => setSubscribing({ plan: plan.key as 'connected' | 'pro', label: plan.display })}
                  disabled={busy !== null} className="btn-primary text-sm w-full">
                  Subscribe to {plan.display}
                </button>
              )}

              {!plan.paid && !isCurrent && (
                <p className="text-xs text-gray-400">Downgrade via Manage billing.</p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-6">
        Payments are processed by Stripe. Liabl never sees or stores your card details.
      </p>

      <div className="mt-10">
        <h3 className="font-serif text-xl mb-1" style={{ letterSpacing: '-0.01em' }}>Accept payments in person</h3>
        <p className="text-sm text-gray-500 mb-4">
          Connect your Stripe account to collect payment from participants during check-in. Funds go
          directly to your Stripe account and pay out to your bank — Liabl never holds your money.
        </p>

        <div className="card">
          {connect.onboarded ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-green-600">✓ Ready to accept payments</div>
                <div className="text-xs text-gray-500">Your Stripe account is connected and can take payments and receive payouts.</div>
              </div>
              <button onClick={refreshConnect} disabled={busy !== null} className="btn-secondary text-sm shrink-0">
                {busy === 'connect-refresh' ? 'Checking…' : 'Refresh'}
              </button>
            </div>
          ) : connect.accountId ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-amber-600">Setup incomplete</div>
                <div className="text-xs text-gray-500">
                  Stripe still needs a few details before you can take payments
                  {connect.chargesEnabled && !connect.payoutsEnabled ? ' (payouts pending)' : ''}.
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={refreshConnect} disabled={busy !== null} className="btn-secondary text-sm">
                  {busy === 'connect-refresh' ? 'Checking…' : 'Refresh'}
                </button>
                <button onClick={setUpPayments} disabled={busy !== null} className="btn-primary text-sm">
                  {busy === 'connect' ? 'Opening…' : 'Finish setup'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink">Not set up yet</div>
                <div className="text-xs text-gray-500">Set up payments to start charging at check-in.</div>
              </div>
              <button onClick={setUpPayments} disabled={busy !== null} className="btn-primary text-sm shrink-0">
                {busy === 'connect' ? 'Opening…' : 'Set up payments'}
              </button>
            </div>
          )}
        </div>
      </div>

      {subscribing && (
        <SubscribeDialog
          plan={subscribing.plan}
          planLabel={subscribing.label}
          onClose={() => setSubscribing(null)}
          onSuccess={onSubscribed}
        />
      )}
    </div>
  )
}
