// lib/email.ts
// v25 M6 security review — real email sending, replacing StepConfirm.tsx's
// previously-false "emailed to you" claim (there was no email-sending
// code anywhere in the app before this).
//
// Server-only: RESEND_API_KEY must never reach the browser bundle. This
// file is only ever imported from a route handler
// (app/api/waivers/[id]/send-confirmation/route.ts), never from a
// 'use client' component.

import { Resend } from 'resend'

let client: Resend | null = null
function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error('RESEND_API_KEY is not set')
    client = new Resend(apiKey)
  }
  return client
}

export interface WaiverConfirmationInput {
  to: string
  participantName: string
  operatorName: string
  activityLabel: string
  signedAt: string   // ISO timestamp
  // Multi-document check-in: titles of any supplemental documents signed
  // alongside the waiver in this check-in. Empty/undefined = waiver only.
  documentTitles?: string[]
}

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || 'LIABL <waivers@liabl.app>'

export async function sendWaiverConfirmationEmail(input: WaiverConfirmationInput): Promise<void> {
  const signedDate = new Date(input.signedAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const signedTime = new Date(input.signedAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  })

  const documentTitles = input.documentTitles ?? []
  const documentsBlock = documentTitles.length > 0
    ? `
        <p style="font-size: 14px; color: #444; line-height: 1.5; margin-top: 16px;">
          You also signed the following ${documentTitles.length === 1 ? 'document' : 'documents'}:
        </p>
        <ul style="font-size: 14px; color: #444; line-height: 1.6; padding-left: 20px; margin-top: 4px;">
          ${documentTitles.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
        </ul>`
    : ''

  const { error } = await getClient().emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: `Your ${input.operatorName} waiver — signed and on file`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="font-size: 18px;">You're all set, ${escapeHtml(firstName(input.participantName))}.</h2>
        <p style="font-size: 14px; color: #444; line-height: 1.5;">
          Your waiver for <strong>${escapeHtml(input.activityLabel)}</strong> with
          <strong>${escapeHtml(input.operatorName)}</strong> was signed on
          ${signedDate} at ${signedTime} and is on file.
        </p>
        ${documentsBlock}
        <p style="font-size: 12px; color: #888; margin-top: 24px;">
          This email confirms your signature was recorded. If you didn't sign this waiver, please contact ${escapeHtml(input.operatorName)} directly.
        </p>
      </div>
    `,
  })

  if (error) throw new Error(`resend: ${error.message}`)
}

export interface TeamInviteInput {
  to: string
  operatorName: string
  inviterName: string
  role: 'owner' | 'staff'
  inviteUrl: string
}

export async function sendTeamInviteEmail(input: TeamInviteInput): Promise<void> {
  const { error } = await getClient().emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: `${input.inviterName} invited you to join ${input.operatorName} on LIABL`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="font-size: 18px;">You've been invited to ${escapeHtml(input.operatorName)}</h2>
        <p style="font-size: 14px; color: #444; line-height: 1.5;">
          ${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.operatorName)}</strong>
          on LIABL as ${input.role === 'owner' ? 'an owner' : 'a staff member'}.
        </p>
        <p style="margin: 24px 0;">
          <a href="${input.inviteUrl}" style="background: #4B2ACF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Accept invitation
          </a>
        </p>
        <p style="font-size: 12px; color: #888;">
          This invitation expires in 7 days. If you weren't expecting this, you can safely ignore it.
        </p>
      </div>
    `,
  })

  if (error) throw new Error(`resend: ${error.message}`)
}

export interface ReservationInviteInput {
  to: string
  organizerName: string     // who's inviting them (the party organizer)
  operatorName: string
  activityLabel: string
  reservationDate: string | null   // ISO date (yyyy-mm-dd) or null
  checkInUrl: string        // the attendee's personal check-in link
}

/** Group reservations — invites one attendee to complete their waiver
 *  ahead of the event via a personal check-in link. Server-only (Resend
 *  key), called from a route handler. */
export async function sendReservationInviteEmail(input: ReservationInviteInput): Promise<void> {
  const dateLabel = input.reservationDate
    ? new Date(`${input.reservationDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null

  const { error } = await getClient().emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: `Complete your waiver for ${input.activityLabel} with ${input.operatorName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="font-size: 18px;">You're invited to complete your waiver</h2>
        <p style="font-size: 14px; color: #444; line-height: 1.5;">
          ${escapeHtml(input.organizerName)} has added you to a group booking for
          <strong>${escapeHtml(input.activityLabel)}</strong> with <strong>${escapeHtml(input.operatorName)}</strong>${dateLabel ? ` on ${dateLabel}` : ''}.
          Please complete your waiver ahead of time so you're all set on the day.
        </p>
        <p style="margin: 24px 0;">
          <a href="${input.checkInUrl}" style="background: #4B2ACF; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
            Complete my waiver
          </a>
        </p>
        <p style="font-size: 12px; color: #888;">
          This link is personal to you. If you weren't expecting this, you can safely ignore it.
        </p>
      </div>
    `,
  })

  if (error) throw new Error(`resend: ${error.message}`)
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'there'
}

// Minimal HTML-escaping for values interpolated into the email body —
// participant name and operator name are user/operator-supplied text,
// not developer-controlled strings, so this isn't optional.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
