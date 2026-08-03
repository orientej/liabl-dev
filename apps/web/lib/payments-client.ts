// lib/payments-client.ts
// Stripe payments — S2b client helpers. NO Stripe SDK import; just fetch
// wrappers around the quote/intent routes plus a money formatter. Used by the
// check-in confirmation screen.

export interface PaymentQuote { payable: boolean; amountCents?: number; currency?: string }

export async function fetchPaymentQuote(waiverId: string): Promise<PaymentQuote> {
  try {
    const res = await fetch(`/api/payments/quote?waiver=${encodeURIComponent(waiverId)}`)
    if (!res.ok) return { payable: false }
    return await res.json()
  } catch { return { payable: false } }
}

export interface IntentResponse { clientSecret?: string; amountCents?: number; currency?: string; skip?: boolean; error?: string }

export async function createPaymentIntent(waiverId: string): Promise<IntentResponse> {
  try {
    const res = await fetch('/api/payments/intent', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ waiverId }),
    })
    return await res.json()
  } catch { return { skip: true } }
}

export function formatMoney(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}
