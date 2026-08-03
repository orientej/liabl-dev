'use client'
// Stripe payments — S2b. The embedded Payment Element the participant uses to
// pay at check-in. Card is entered directly into Stripe-hosted fields (SAQ-A);
// the charge is a destination charge to the operator's connected account. The
// client secret is created server-side (server derives the amount).
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { formatMoney } from '@/lib/payments-client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

export default function PaymentPanel({ clientSecret, amountCents, currency, accent, onPaid }: {
  clientSecret: string; amountCents: number; currency: string; accent?: string; onPaid: () => void
}) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: accent || '#4B2ACF' } } }}>
      <PayForm amountCents={amountCents} currency={currency} onPaid={onPaid} />
    </Elements>
  )
}

function PayForm({ amountCents, currency, onPaid }: { amountCents: number; currency: string; onPaid: () => void }) {
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
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })
    if (err) {
      setError(err.message || 'Payment could not be completed.')
      setSubmitting(false)
      return
    }
    onPaid()
  }

  return (
    <form onSubmit={submit}>
      <PaymentElement />
      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      <button type="submit" disabled={!stripe || submitting} className="btn-primary text-sm w-full mt-4">
        {submitting ? 'Processing…' : `Pay ${formatMoney(amountCents, currency)}`}
      </button>
    </form>
  )
}
