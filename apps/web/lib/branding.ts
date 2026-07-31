// lib/branding.ts
// Private labeling — the per-operator brand (logo + primary/accent colors +
// "hide Powered by Liabl") and the runtime-theming helpers that turn two
// picked colors into the CSS variables the Tailwind preset reads. Client-safe
// (no server-only imports): used by the participant flow, the console editor,
// and server code alike. Resolution takes whatever Supabase client the caller
// already has (anon on participant surfaces, authenticated in the console).
//
// How theming works: packages/ui/tailwind-preset.js expresses brand/accent as
// rgb(var(--…-rgb, <default>) / <alpha-value>). brandingStyle() below emits a
// :root { … } block setting those variables from the operator's colors; when
// no block is emitted, the preset's fallbacks reproduce the Liabl palette
// exactly. So an operator with no branding row changes nothing.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface Branding {
  logoUrl:       string | null
  primaryColor:  string | null   // '#RRGGBB' or null (= Liabl default)
  accentColor:   string | null   // '#RRGGBB' or null (= Liabl default)
  hidePoweredBy: boolean
}

export const LIABL_DEFAULT_PRIMARY = '#4B2ACF'
export const LIABL_DEFAULT_ACCENT  = '#EA580C'

export const EMPTY_BRANDING: Branding = {
  logoUrl: null, primaryColor: null, accentColor: null, hidePoweredBy: false,
}

// ── Color math ───────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{6})$/

/** Validate a '#RRGGBB' string. */
export function isValidHex(v: string | null | undefined): v is string {
  return !!v && HEX_RE.test(v.trim())
}

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(HEX_RE)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(c: [number, number, number], t: [number, number, number], amt: number): [number, number, number] {
  return [
    Math.round(c[0] * (1 - amt) + t[0] * amt),
    Math.round(c[1] * (1 - amt) + t[1] * amt),
    Math.round(c[2] * (1 - amt) + t[2] * amt),
  ]
}
const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]
const chan = (c: [number, number, number]) => `${c[0]} ${c[1]} ${c[2]}`

/**
 * A four-stop brand ramp derived from one picked color, mirroring the shape
 * of the Liabl default ramp (light tint, base, slightly-lighter mid, darker
 * deep). Returns space-separated RGB channels for CSS custom properties, or
 * null for an invalid hex (caller then leaves the defaults in place).
 */
export function brandRamp(hex: string): { DEFAULT: string; light: string; mid: string; deep: string } | null {
  const p = parseHex(hex)
  if (!p) return null
  return { DEFAULT: chan(p), light: chan(mix(p, WHITE, 0.90)), mid: chan(mix(p, WHITE, 0.14)), deep: chan(mix(p, BLACK, 0.20)) }
}

export function accentRamp(hex: string): { DEFAULT: string; light: string; deep: string } | null {
  const p = parseHex(hex)
  if (!p) return null
  return { DEFAULT: chan(p), light: chan(mix(p, WHITE, 0.88)), deep: chan(mix(p, BLACK, 0.20)) }
}

/**
 * The CSS text for a :root override, or '' when the operator has no valid
 * colors (so <BrandStyle> renders nothing and defaults stand). Only sets the
 * variables for colors that are present + valid — a valid primary with no
 * accent themes just the primary.
 */
export function brandingCss(branding: Branding): string {
  const decls: string[] = []
  if (isValidHex(branding.primaryColor)) {
    const r = brandRamp(branding.primaryColor)!
    decls.push(`--brand-rgb:${r.DEFAULT}`, `--brand-light-rgb:${r.light}`, `--brand-mid-rgb:${r.mid}`, `--brand-deep-rgb:${r.deep}`)
  }
  if (isValidHex(branding.accentColor)) {
    const a = accentRamp(branding.accentColor)!
    decls.push(`--accent-rgb:${a.DEFAULT}`, `--accent-light-rgb:${a.light}`, `--accent-deep-rgb:${a.deep}`)
  }
  return decls.length ? `:root{${decls.join(';')}}` : ''
}

// ── Resolution ─────────────────────────────────────────────────────────────

/**
 * Read an operator's branding with whatever client the caller has. Returns
 * EMPTY_BRANDING when there is no row or on any error — branding must never
 * take a surface down, so a failure degrades to the Liabl look, not a crash.
 */
export async function fetchBranding(client: SupabaseClient, operatorId: string): Promise<Branding> {
  try {
    const { data } = await client
      .from('operator_branding')
      .select('logo_url, primary_color, accent_color, hide_powered_by')
      .eq('operator_id', operatorId)
      .maybeSingle()
    if (!data) return EMPTY_BRANDING
    return {
      logoUrl:       data.logo_url ?? null,
      primaryColor:  data.primary_color ?? null,
      accentColor:   data.accent_color ?? null,
      hidePoweredBy: !!data.hide_powered_by,
    }
  } catch {
    return EMPTY_BRANDING
  }
}
