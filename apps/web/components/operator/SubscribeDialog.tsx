'use client'
// Stripe payments — S1 (embedded subscribe). A modal that collects the card
// with Stripe's Payment Element right inside Liabl — no redirect to Stripe.
// It creates a deferred subscription (client secret from the server), mounts
// the Payment Element, and confirms in-page. The webhook flips the operator to
// the paid plan once payment succeeds.
import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { createSubscription } from '@/lib/billing-client'

// Publishable key is safe in the browser. loadStripe is memoized at module
// scope so the SDK loads once.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

export default function SubscribeDialog({ plan, planLabel, onClose, onSuccess }: {
  plan: 'connected' | 'pro'; planLabel: string; onClose: () => void; onSuccess: () => void
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const cs = await createSubscription(plan)
        if (live) setClientSecret(cs)
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Could not start the subscription.')
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => { live = false }
  }, [plan])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-medium text-ink">Subscribe to {planLabel}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-ink text-lg leading-none">&times;</button>
        </div>
        <p className="text-xs text-gray-500 mb-4">Secured by Stripe. Your card is entered directly with Stripe — Liabl never sees it.</p>

        {loading && <div className="text-sm text-gray-500 py-6 text-center">Preparing secure payment…</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#4B2ACF' } } }}>
            <PayForm planLabel={planLabel} onSuccess={onSuccess} onCancel={onClose} />
          </Elements>
        )}
      </div>
    </div>
  )
}

function PayForm({ planLabel, onSuccess, onCancel }: { planLabel: string; onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true); setError(null)
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/operator?billing=success` },
      redirect: 'if_required',   // cards complete in-page; only redirect-based methods leave
    })
    if (err) {
      setError(err.message || 'Payment could not be completed.')
      setSubmitting(false)
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={submit}>
      <PaymentElement />
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      <button type="submit" disabled={!stripe || submitting} className="btn-primary text-sm w-full mt-4">
        {submitting ? 'Processing…' : `Subscribe to ${planLabel}`}
      </button>
      <button type="button" onClick={onCancel} disabled={submitting} className="text-xs text-gray-400 hover:text-ink w-full mt-2">
        Cancel
      </button>
    </form>
  )
}
