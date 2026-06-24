// Bridge between the Tiptap canvas (which serializes to HTML via getHTML()) and the
// rest of the app, which stores and reasons about `body` as PLAIN TEXT.
//
// Why plain text: the review API quote-matches against the text it is given, and the
// canvas overlay locates each quote inside a single text node. Storing HTML would put
// `<p>` tags into the text the model sees and the highlighter searches, breaking both.
// Seed bodies are already plain text, so this keeps every body uniform.
//
// Conversion is DOM-free (works in SSR, the route handler, and tests): paragraphs and
// line breaks become newlines, remaining tags are stripped, HTML entities decoded.

const BLOCK_BOUNDARY = /<\/(p|div|h[1-6]|li|blockquote)>/gi
const LINE_BREAK = /<br\s*\/?>/gi

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;|&nbsp;/g, (m) => ENTITIES[m] ?? m)
}

/**
 * Convert editor HTML to the plain-text `body` we store/compare/send. Returns text
 * unchanged if it contains no tags (so passing already-plain bodies is a no-op).
 */
export function htmlToText(html: string): string {
  if (!html || (!html.includes('<') && !html.includes('&'))) return html
  const withBreaks = html.replace(BLOCK_BOUNDARY, '\n').replace(LINE_BREAK, '\n')
  const stripped = withBreaks.replace(/<[^>]*>/g, '')
  return decodeEntities(stripped).replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Wrap plain-text body into the minimal HTML the canvas expects as `content`. Each
 * line becomes a paragraph; blank input yields an empty document. Tiptap also accepts
 * a bare string, but emitting `<p>` keeps the round-trip stable.
 */
export function textToHtml(text: string): string {
  if (!text.trim()) return ''
  return text
    .split(/\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
