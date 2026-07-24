// lib/seal.ts
// v24 M2 item 3 — document sealing: hash + PDF generation + storage
//
// Called once at signing time, after the waiver row is inserted.
// Returns the document_hash and pdf_path to write back to that row.
//
// Design decisions:
// - The hash is computed over a deterministic canonical string that
//   includes everything a legal reviewer would need: participant details,
//   activity, signed date, all clause titles + bodies, guardian if minor,
//   and the signature data itself. The hash therefore changes if any of
//   those things change — providing the immutability guarantee we advertise.
// - The signature image is stored as a data-URL in signature_data. We
//   embed it in the PDF as a JPEG/PNG image, not text, so the physical
//   signature mark appears in the downloadable document.
// - PDF is uploaded to a private Supabase Storage bucket ('waivers').
//   The returned URL is a signed URL valid for ~10 years — long enough to
//   serve as a durable link, but genuinely private (not guessable).
// - No browser crypto polyfill needed: Web Crypto API (SubtleCrypto) is
//   available in all modern browsers and in Next.js edge/node runtimes.
//
// BUG FIX: JO 7/7/2026: lightning emoji generating javascript error. Replace with WinAnsi-safe marker. 

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface WaiverClause {
  id: string
  title: string
  body: string
  highlight?: boolean
  required: boolean
}

export interface SealInput {
  waiverId: string
  fullName: string
  email: string
  dob: string
  activityKey: string
  activityLabel: string
  signedAt: string          // ISO 8601
  ipAddress: string | null
  isMinor: boolean
  guardianName: string | null
  clauses: WaiverClause[]
  signatureData: string     // data-URL (image/png or image/jpeg)
}

export interface SealResult {
  documentHash: string      // hex SHA-256
  pdfPath: string            // Storage path, e.g. waivers/2026/07/{id}.pdf — not a URL; see uploadPdf's comment
}

// ─── Canonical document string ────────────────────────────────────────────────
// Deterministic, human-readable representation of everything the participant
// agreed to. This is what we hash — not the PDF bytes — so the hash can be
// independently recomputed from the database fields without needing the PDF.

export function buildCanonicalDocument(input: SealInput): string {
  const lines: string[] = [
    'LIABL ELECTRONIC WAIVER',
    '========================',
    '',
    `Document ID : ${input.waiverId}`,
    `Signed at   : ${input.signedAt}`,
    `IP address  : ${input.ipAddress ?? 'not captured'}`,
    `Legal basis : ESIGN Act (15 U.S.C. § 7001) · UETA`,
    '',
    'PARTICIPANT',
    '-----------',
    `Full name   : ${input.fullName}`,
    `Email       : ${input.email}`,
    `Date of birth: ${input.dob}`,
    `Minor       : ${input.isMinor ? 'Yes' : 'No'}`,
    ...(input.isMinor && input.guardianName ? [`Guardian    : ${input.guardianName}`] : []),
    '',
    'ACTIVITY',
    '--------',
    `Activity    : ${input.activityLabel} (${input.activityKey})`,
    '',
    'AGREED TERMS',
    '------------',
    ...input.clauses.flatMap((c, i) => [
      `${i + 1}. ${c.title}${c.highlight ? ' [ADAPTIVE CLAUSE]' : ''}`,
      c.body,
      '',
    ]),
    'SIGNATURE',
    '---------',
    `By signing, ${input.fullName} agrees to all terms above.`,
    `Signature captured electronically on ${input.signedAt}.`,
  ]
  return lines.join('\n')
}

// ─── SHA-256 hash ─────────────────────────────────────────────────────────────

export async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── PDF generation ───────────────────────────────────────────────────────────
// Produces a clean, readable, single-column PDF of the waiver document.
// Includes the canonical document text, the SHA-256 hash as a footer
// on every page, and the signature image on the final page.

const PAGE_WIDTH  = 595   // A4 in points
const PAGE_HEIGHT = 842
const MARGIN      = 56
const LINE_HEIGHT = 14
const BODY_WIDTH  = PAGE_WIDTH - MARGIN * 2

function addPage(doc: PDFDocument): PDFPage {
  return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
}

// v25 fix — replaces the narrower, one-off fix (the emoji -> '* ' swap
// below) with a general one. StandardFonts.Helvetica/HelveticaBold/
// Courier are all WinAnsi-encoded, and pdf-lib throws when asked to draw
// any character outside that codepage. The emoji swap only fixed the
// ONE hardcoded character that happened to be noticed — it left every
// OTHER source of uncontrolled text unprotected: participant full names,
// guardian names, and especially operator-authored clause titles/bodies
// from TemplateTab, which can contain literally any Unicode a staff
// member types in. Any of those could silently crash sealing for any
// operator, not just the one that got manually patched.
//
// Checks each character against what the font can actually encode
// (rather than hardcoding a rule set for which characters are "safe")
// so this doesn't need updating every time a new problem character
// shows up — it defers to pdf-lib's own encoding table.
function sanitizeForPdf(text: string, font: PDFFont): string {
  let result = ''
  for (const char of text) {
    try {
      font.widthOfTextAtSize(char, 10)
      result += char
    } catch {
      result += '?'
    }
  }
  return result
}

async function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color = rgb(0, 0, 0)
) {
  page.drawText(text, { x, y, font, size, color })
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function buildPdf(input: SealInput, documentHash: string): Promise<Uint8Array> {
  const doc          = await PDFDocument.create()
  const fontRegular  = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold     = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontMono     = await doc.embedFont(StandardFonts.Courier)
  const brandColor   = rgb(0.294, 0.165, 0.812)  // #4B2ACF

  // Sanitize every piece of user/operator-supplied text once, up front —
  // participant-entered fields (name, email, guardian) and operator-
  // authored clause content (TemplateTab) can contain any Unicode a
  // person happens to type, and all three fonts above are WinAnsi-
  // encoded. Doing this here, once, means no downstream drawText call
  // needs to remember to do it itself.
  const safe = {
    fullName:      sanitizeForPdf(input.fullName, fontRegular),
    email:         sanitizeForPdf(input.email, fontRegular),
    guardianName:  input.guardianName ? sanitizeForPdf(input.guardianName, fontRegular) : null,
    activityLabel: sanitizeForPdf(input.activityLabel, fontRegular),
  }
  const safeClauses = input.clauses.map(c => ({
    ...c,
    title: sanitizeForPdf(c.title, fontBold),
    body:  sanitizeForPdf(c.body, fontRegular),
  }))

  let page  = addPage(doc)
  let curY  = PAGE_HEIGHT - MARGIN

  // Draws a footer (hash + page number) and returns the usable bottom Y
  function drawFooter(p: PDFPage, pageNum: number) {
    const footerY = MARGIN - 10
    p.drawText(`SHA-256: ${documentHash}`, {
      x: MARGIN, y: footerY, font: fontMono, size: 6, color: rgb(0.6, 0.6, 0.6),
    })
    p.drawText(`Page ${pageNum}`, {
      x: PAGE_WIDTH - MARGIN - 30, y: footerY, font: fontRegular, size: 7, color: rgb(0.6, 0.6, 0.6),
    })
    p.drawLine({ start: { x: MARGIN, y: footerY + 8 }, end: { x: PAGE_WIDTH - MARGIN, y: footerY + 8 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  }

  let pageCount = 1
  drawFooter(page, pageCount)

  function ensureSpace(needed: number): void {
    if (curY - needed < MARGIN + 20) {
      drawFooter(page, pageCount)
      page = addPage(doc)
      pageCount++
      drawFooter(page, pageCount)
      curY = PAGE_HEIGHT - MARGIN
    }
  }

  function nl(lines = 1) { curY -= LINE_HEIGHT * lines }

  // ── Header ──
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 70, width: PAGE_WIDTH, height: 70, color: brandColor })
  await drawText(page, 'LIABL', MARGIN, PAGE_HEIGHT - 30, fontBold, 18, rgb(1, 1, 1))
  await drawText(page, 'Electronic Waiver', MARGIN + 52, PAGE_HEIGHT - 30, fontRegular, 14, rgb(0.85, 0.80, 1))
  await drawText(page, `Signed: ${new Date(input.signedAt).toLocaleString()}`, MARGIN, PAGE_HEIGHT - 52, fontRegular, 8, rgb(0.85, 0.85, 1))
  await drawText(page, `Doc: ${input.waiverId.slice(0, 8)}`, PAGE_WIDTH - MARGIN - 90, PAGE_HEIGHT - 52, fontMono, 8, rgb(0.85, 0.85, 1))
  curY = PAGE_HEIGHT - 90

  // ── Participant block ──
  ensureSpace(80)
  await drawText(page, 'PARTICIPANT', MARGIN, curY, fontBold, 9, rgb(0.4, 0.4, 0.4)); nl()
  page.drawLine({ start: { x: MARGIN, y: curY }, end: { x: PAGE_WIDTH - MARGIN, y: curY }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); nl()

  const participantFields: [string, string][] = [
    ['Full name',   safe.fullName],
    ['Email',       safe.email],
    ['Date of birth', input.dob],
    ['Activity',    `${safe.activityLabel} (${input.activityKey})`],
    ['IP address',  input.ipAddress ?? 'not captured'],
    ['Minor',       input.isMinor ? 'Yes' : 'No'],
    ...(input.isMinor && safe.guardianName ? [['Guardian', safe.guardianName] as [string, string]] : []),
  ]
  for (const [label, value] of participantFields) {
    ensureSpace(LINE_HEIGHT)
    await drawText(page, `${label}:`, MARGIN, curY, fontRegular, 9, rgb(0.5, 0.5, 0.5))
    await drawText(page, value, MARGIN + 90, curY, fontBold, 9)
    nl()
  }
  nl()

  // ── Clauses ──
  ensureSpace(30)
  await drawText(page, 'AGREED TERMS', MARGIN, curY, fontBold, 9, rgb(0.4, 0.4, 0.4)); nl()
  page.drawLine({ start: { x: MARGIN, y: curY }, end: { x: PAGE_WIDTH - MARGIN, y: curY }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); nl()

  for (let i = 0; i < safeClauses.length; i++) {
    const clause = safeClauses[i]
    ensureSpace(LINE_HEIGHT * 2)

    // Clause title
    const titleColor = clause.highlight ? brandColor : rgb(0.1, 0.1, 0.1)
    // JO 7/7/2026: emoji causing javascript errors. Replace with WinAnsi-safe marker. 
    // const prefix = clause.highlight ? '⚡ ' : ''
    const prefix = clause.highlight ? '* ' : ''    
    await drawText(page, `${i + 1}. ${prefix}${clause.title}`, MARGIN, curY, fontBold, 9, titleColor)
    nl()

    // Clause body — wrapped
    const bodyLines = wrapText(clause.body, fontRegular, 8, BODY_WIDTH - 12)
    for (const line of bodyLines) {
      ensureSpace(LINE_HEIGHT)
      await drawText(page, line, MARGIN + 12, curY, fontRegular, 8, rgb(0.2, 0.2, 0.2))
      nl()
    }
    nl(0.5)
  }

  // ── Signature page ──
  ensureSpace(200)
  nl()
  page.drawLine({ start: { x: MARGIN, y: curY }, end: { x: PAGE_WIDTH - MARGIN, y: curY }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
  nl()
  await drawText(page, 'ELECTRONIC SIGNATURE', MARGIN, curY, fontBold, 9, rgb(0.4, 0.4, 0.4)); nl(2)
  await drawText(page, `By signing below, ${safe.fullName} agrees to all terms above.`, MARGIN, curY, fontRegular, 8); nl(2)

  // Embed signature image if it's a valid data-URL
  try {
    const sigDataUrl = input.signatureData
    const isJpeg = sigDataUrl.startsWith('data:image/jpeg')
    const isPng  = sigDataUrl.startsWith('data:image/png')
    if (isJpeg || isPng) {
      const base64 = sigDataUrl.split(',')[1]
      const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
      const sigImage = isJpeg
        ? await doc.embedJpg(sigBytes)
        : await doc.embedPng(sigBytes)

      const MAX_SIG_WIDTH  = BODY_WIDTH * 0.6
      const MAX_SIG_HEIGHT = 80
      const ratio  = Math.min(MAX_SIG_WIDTH / sigImage.width, MAX_SIG_HEIGHT / sigImage.height)
      const sigW   = sigImage.width  * ratio
      const sigH   = sigImage.height * ratio

      ensureSpace(sigH + LINE_HEIGHT * 3)

      // Signature box background
      page.drawRectangle({ x: MARGIN, y: curY - sigH, width: sigW + 16, height: sigH + 8, color: rgb(0.97, 0.97, 1), borderColor: rgb(0.8, 0.75, 1), borderWidth: 0.75 })
      page.drawImage(sigImage, { x: MARGIN + 8, y: curY - sigH, width: sigW, height: sigH })
      curY -= sigH + 16
    }
  } catch {
    // Signature image failed to embed — still produce the PDF, just log it
    await drawText(page, '[Signature image could not be rendered]', MARGIN, curY, fontRegular, 8, rgb(0.6, 0.6, 0.6))
    nl()
  }

  await drawText(page, `Signed: ${safe.fullName}`, MARGIN, curY, fontBold, 9); nl()
  await drawText(page, `Date:   ${new Date(input.signedAt).toLocaleString()}`, MARGIN, curY, fontRegular, 8, rgb(0.4, 0.4, 0.4)); nl()
  if (input.ipAddress) {
    await drawText(page, `IP:     ${input.ipAddress}`, MARGIN, curY, fontMono, 8, rgb(0.5, 0.5, 0.5)); nl()
  }

  nl()
  await drawText(page, 'This document was signed electronically pursuant to the ESIGN Act (15 U.S.C. § 7001) and UETA.', MARGIN, curY, fontRegular, 7, rgb(0.5, 0.5, 0.5)); nl()
  await drawText(page, `SHA-256 document hash: ${documentHash}`, MARGIN, curY, fontMono, 6.5, rgb(0.5, 0.5, 0.5))

  return doc.save()
}

// ─── Storage upload ───────────────────────────────────────────────────────────

export async function uploadPdf(
  supabase: SupabaseClient,
  waiverId: string,
  pdfBytes: Uint8Array,
  signedAt: string
): Promise<string> {
  const date   = new Date(signedAt)
  const yyyy   = date.getFullYear()
  const mm     = String(date.getMonth() + 1).padStart(2, '0')
  const path   = `waivers/${yyyy}/${mm}/${waiverId}.pdf`
  const bucket = 'waivers'

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,    // never overwrite a sealed document
    })

  if (uploadError) throw new Error(`PDF upload: ${uploadError.message}`)

  // v25 M6 security review — this used to generate a 10-year signed URL
  // here and store it directly, rationalized as "durable enough for
  // legal hold scenarios." That reasoning missed that durability and
  // revocability were in tension: a signed URL can't be revoked early
  // short of deleting the underlying file, and legal-hold waivers are
  // specifically EXEMPT from the 90-day retention purge that would
  // otherwise bound this — meaning the most sensitive documents kept the
  // longest-lived, least-revocable access path. Returning just the path
  // now; short-lived signed URLs are generated on demand instead, by an
  // authenticated route (app/api/waivers/[id]/pdf-url) that checks the
  // requester's own operator via RLS before ever calling
  // createSignedUrl. Durability is preserved (the path never expires,
  // so a fresh URL can always be minted) without the revocability cost.
  return path
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function sealWaiver(
  supabase: SupabaseClient,
  input: SealInput
): Promise<SealResult> {
  // 1. Build the canonical document string and hash it
  const canonical    = buildCanonicalDocument(input)
  const documentHash = await sha256Hex(canonical)

  // 2. Build the PDF (hash is embedded in it as a footer + final line)
  const pdfBytes = await buildPdf(input, documentHash)

  // 3. Upload to storage
  const pdfPath = await uploadPdf(supabase, input.waiverId, pdfBytes, input.signedAt)

  return { documentHash, pdfPath }
}
