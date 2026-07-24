// lib/document-extract.ts
// Content Management — waiver upload/parse, Stage 1: text extraction.
//
// Single entry point extractText() that dispatches by file type and
// returns normalized text plus metadata. This is deliberately the ONLY
// place that knows about specific extraction libraries — the upload
// route and everything downstream (Stage 3's clause segmentation) work
// against the ExtractResult shape, not against pdf-parse/mammoth
// directly. That keeps the Azure OCR path (Stage 2) a localized change:
// scanned PDFs will route to a new branch here and nothing upstream or
// downstream needs to know.
//
// Runtime note: this must run in the Node.js serverless runtime (not
// edge) — pdf-parse and mammoth both depend on Node built-ins. Routes
// using this set `export const runtime = 'nodejs'`.

import mammoth from 'mammoth'

export type ExtractionMethod = 'pdf-text' | 'docx' | 'plain-text' | 'ocr-azure'

export interface ExtractResult {
  text:        string
  method:      ExtractionMethod
  pageCount:   number | null
  // True when a born-digital PDF yielded little or no text — the strong
  // signal that it's actually a SCANNED pdf and needs OCR (Stage 2)
  // rather than direct text extraction. Stage 1 surfaces this flag but
  // can't act on it yet; the upload route uses it to tell the operator
  // "this looks scanned, OCR support is coming" rather than silently
  // returning an empty template.
  likelyScanned: boolean
}

// A born-digital PDF page almost always yields far more than this many
// characters of real text. When a whole PDF comes in under this, it's
// overwhelmingly likely to be a scan (an image of text) rather than a
// text PDF — the case Stage 2's OCR will handle.
const SCANNED_TEXT_THRESHOLD = 100

export interface ExtractInput {
  buffer:   Buffer
  mimeType: string
  filename: string
}

export async function extractText(input: ExtractInput): Promise<ExtractResult> {
  const { buffer, mimeType, filename } = input
  const lowerName = filename.toLowerCase()

  // Dispatch by MIME type first, falling back to file extension — some
  // browsers send generic or empty MIME types for uploads, so the
  // extension is a needed backstop.
  const isPdf =
    mimeType === 'application/pdf' || lowerName.endsWith('.pdf')
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx')
  const isDoc =
    mimeType === 'application/msword' || lowerName.endsWith('.doc')
  const isPlainText =
    mimeType === 'text/plain' || lowerName.endsWith('.txt')

  if (isPdf)       return extractPdf(buffer)
  if (isDocx)      return extractDocx(buffer)
  if (isPlainText) return extractPlainText(buffer)
  if (isDoc) {
    // Legacy .doc (binary Word 97-2003) isn't supported by mammoth,
    // which handles .docx only. Rather than fail obscurely, say so
    // clearly — the operator can re-save as .docx or PDF.
    throw new UnsupportedFormatError(
      'Legacy .doc files aren\u2019t supported. Please re-save as .docx or PDF and upload again.'
    )
  }

  throw new UnsupportedFormatError(
    `Unsupported file type${mimeType ? ` (${mimeType})` : ''}. Upload a PDF, Word (.docx), or plain-text file.`
  )
}

async function extractPdf(buffer: Buffer): Promise<ExtractResult> {
  // pdf-parse@2.x uses a class-based API: new PDFParse({ data }).getText().
  // Imported lazily so the (Node-only) dependency never gets pulled into
  // an edge bundle by accident.
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    // pdf-parse joins pages with a "-- N of M --" separator line; strip
    // those so downstream segmentation sees clean prose, not pagination
    // artifacts.
    const cleaned = result.text
      .replace(/^-- \d+ of \d+ --$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    const pageCount = typeof result.total === 'number' ? result.total : null
    const likelyScanned = cleaned.length < SCANNED_TEXT_THRESHOLD

    return { text: cleaned, method: 'pdf-text', pageCount, likelyScanned }
  } finally {
    await parser.destroy()
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractResult> {
  const result = await mammoth.extractRawText({ buffer })
  const cleaned = result.value.replace(/\n{3,}/g, '\n\n').trim()
  return { text: cleaned, method: 'docx', pageCount: null, likelyScanned: false }
}

function extractPlainText(buffer: Buffer): Promise<ExtractResult> {
  const cleaned = buffer.toString('utf-8').replace(/\n{3,}/g, '\n\n').trim()
  return Promise.resolve({ text: cleaned, method: 'plain-text', pageCount: null, likelyScanned: false })
}

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedFormatError'
  }
}
