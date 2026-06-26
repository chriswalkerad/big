// Deterministic mock provider — the default when no API key is set. Given the same
// `text` it returns byte-identical output (a small PRNG seeded from a hash of the
// text). It works for ANY pasted concept, not just the seeded docs, via per-signal
// heuristics with a generic fallback. Inline issues set `quote` to a REAL substring
// of `text` so canvas highlighting anchors correctly.

import type {
  ReviewResult,
  ReviewVerdict,
  SignalDef,
  SignalIssue,
  SignalResult,
  TextSubtype,
} from '@/types'
import type { ApplyInput, ReviewInput, ReviewProvider } from './interface'

// --- Deterministic PRNG --------------------------------------------------------

/** FNV-1a 32-bit hash. Stable across runs, good enough to seed a PRNG. */
function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // h *= 16777619, kept in 32-bit range
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 — tiny, fast, deterministic PRNG returning floats in [0, 1). */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic small jitter in [-10, 10], so two distinct texts rarely tie. */
function jitter(rng: () => number): number {
  return Math.round((rng() * 2 - 1) * 10)
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

// --- Text utilities ------------------------------------------------------------

function splitSentences(text: string): string[] {
  // Keep sentences as trimmed substrings of the original so quotes can be derived
  // from them and still appear verbatim in `text` after re-trimming.
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function firstLine(text: string): string {
  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? ''
  return line
}

function wordCount(text: string): number {
  const m = text.trim().match(/\S+/g)
  return m ? m.length : 0
}

function longestSentence(text: string): string {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return ''
  return sentences.reduce((a, b) => (b.length > a.length ? b : a))
}

/**
 * Return the exact substring of `text` (preserving original casing/punctuation)
 * that corresponds to `candidate`, or null if it is not literally present. We
 * search case-insensitively but slice from the original so the quote is verbatim.
 */
function exactSubstring(text: string, candidate: string): string | null {
  if (!candidate) return null
  const idx = text.toLowerCase().indexOf(candidate.toLowerCase())
  if (idx === -1) return null
  return text.slice(idx, idx + candidate.length)
}

// --- Brand safety risky phrases -----------------------------------------------
// Ordered most-specific first. Must include the terms that trigger the seeded
// Brand Safety flags so a live re-review of the seeded docs reproduces their
// stored not_ready snapshots (e.g. "body count", "never seen again").

interface RiskyTerm {
  pattern: RegExp
  message: string
}

const RISKY_TERMS: RiskyTerm[] = [
  { pattern: /a rising body count[^.!?]*/i, message: "A body count is off-limits for a kids' brand" },
  { pattern: /body count/i, message: "A body count is off-limits for a kids' brand" },
  { pattern: /(?:they're|they are|theyre) never seen again/i, message: 'Implied harm to people; too dark for ages 6-12' },
  { pattern: /never seen again/i, message: 'Implied harm to people; too dark for ages 6-12' },
  { pattern: /jump scares?/i, message: 'Horror imagery is unsafe for a family audience' },
  { pattern: /\bgore\b|\bgory\b/i, message: 'Graphic content is off-brand for kids 6-12' },
  { pattern: /\bblood(?:y|shed)?\b/i, message: 'Violent imagery is unsafe for a family audience' },
  { pattern: /\bkills?\b|\bkilling\b|\bkilled\b/i, message: 'Depicted killing is off-limits for a kids brand' },
  { pattern: /\bmurder(?:s|ed|er)?\b/i, message: 'Depicted murder is off-limits for a kids brand' },
  { pattern: /\bweapons?\b|\bgun\b|\bknife\b/i, message: 'Weapons are off-brand for a family audience' },
  { pattern: /\bdrugs?\b|\balcohol\b|\bcigarettes?\b/i, message: 'Mature substances are off-brand for kids 6-12' },
  { pattern: /\bcurse\b|\bswear(?:ing)?\b|\bprofanity\b/i, message: 'Coarse language is off-brand for a family audience' },
  { pattern: /\bsexual\b|\bsex\b/i, message: 'Mature themes are unsafe for ages 6-12' },
]

// --- Vague / unclear phrases (Clarity) ----------------------------------------

const VAGUE_PATTERNS: RegExp[] = [
  /[^.!?]*\b(?:a whole vibe|the energy is there|some kind of|sort of|kind of|stuff like that|or something|whatever|tbd|etc)\b[^.!?]*/i,
  /[^.!?]*\bnot (?:totally |entirely )?sure[^.!?]*/i,
  /[^.!?]*\bwe'?ll see\b[^.!?]*/i,
  /[^.!?]*\bsomehow\b[^.!?]*/i,
]

// --- Subtype classifier --------------------------------------------------------

// Each subtype has a set of keyword signals; we score the text against all of
// them and pick the strongest match. This avoids first-match bias from incidental
// words (e.g. a story premise that merely mentions "the Plaza"). Ties resolve to
// the array order, with story_premise as the final fallback.
const SUBTYPE_KEYWORDS: Array<{ subtype: TextSubtype; words: RegExp[] }> = [
  {
    subtype: 'script_excerpt',
    words: [/\bINT\.|\bEXT\./, /\bfade in\b/i, /\bcut to\b/i, /\bvoice ?over\b/i, /\(beat\)/i, /\bdialogue\b/i],
  },
  {
    subtype: 'creative_brief',
    words: [/\bbrief\b/i, /\bdeliverable/i, /\bobjective/i, /\bkpi\b/i, /\bcampaign\b/i, /\bstakeholder/i, /\bbrand guidelines\b/i],
  },
  {
    subtype: 'character_concept',
    words: [/\bcharacter\b/i, /\bprotagonist\b/i, /\bpersonality\b/i, /\ba new (?:kid|character|friend)\b/i, /\brecurring character\b/i, /\bcast\b/i],
  },
  {
    subtype: 'world_building',
    words: [/\bworld[- ]?build/i, /\bsetting\b/i, /\buniverse\b/i, /\blore\b/i, /\bmythology\b/i, /\bkingdom\b/i, /\bmap\b/i],
  },
  {
    subtype: 'story_premise',
    words: [/\bwhen\b/i, /\bdiscovers?\b/i, /\badventure\b/i, /\bpremise\b/i, /\bpilot\b/i, /\bepisode\b/i, /\bshort\b/i, /\bseries\b/i, /\bcaper\b/i],
  },
]

function detectSubtype(text: string): TextSubtype {
  let best: TextSubtype = 'story_premise'
  let bestScore = 0
  for (const { subtype, words } of SUBTYPE_KEYWORDS) {
    const score = words.reduce((n, w) => (w.test(text) ? n + 1 : n), 0)
    if (score > bestScore) {
      bestScore = score
      best = subtype
    }
  }
  return best
}

// --- Theme extraction ----------------------------------------------------------

const THEME_KEYWORDS: Array<{ theme: string; words: RegExp }> = [
  { theme: 'friendship', words: /\b(?:friend|friendship|companion|company|together|buddy)\b/i },
  { theme: 'adventure', words: /\b(?:adventure|quest|journey|caper|escapade|explore)\b/i },
  { theme: 'mystery', words: /\b(?:mystery|secret|hidden|clue|uncover|investigat)\b/i },
  { theme: 'rivalry', words: /\b(?:rival|competition|compete|enemy|nemesis)\b/i },
  { theme: 'bravery', words: /\b(?:brave|courage|outwit|stand up|fearless)\b/i },
  { theme: 'ghost story', words: /\b(?:haunted|ghost|vengeful|spirit|phantom)\b/i },
  { theme: 'hospitality', words: /\b(?:hotel|room-service|room service|guest|concierge|plaza|menu|chef)\b/i },
  { theme: 'family', words: /\b(?:family|nanny|home|sibling|parent)\b/i },
]

function extractThemes(text: string): string[] {
  const found: string[] = []
  for (const { theme, words } of THEME_KEYWORDS) {
    if (words.test(text) && !found.includes(theme)) found.push(theme)
    if (found.length >= 3) break
  }
  if (found.length === 0) found.push('general')
  return found
}

// --- Title suggestion ----------------------------------------------------------

function suggestTitle(text: string): string {
  const line = firstLine(text)
  if (!line) return 'Untitled Concept'
  // First sentence of the first line, capped to a reasonable headline length.
  const firstSentence = splitSentences(line)[0] ?? line
  const trimmed = firstSentence.replace(/[.!?]+$/, '').trim()
  if (trimmed.length <= 60) return trimmed
  const cut = trimmed.slice(0, 60)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

// --- Per-signal heuristics -----------------------------------------------------

interface SignalEval {
  score: number
  rationale: string
  issues: SignalIssue[]
}

interface HeuristicContext {
  text: string
  words: number
  sentences: string[]
  first: string
  rng: () => number
}

/** Match a signal to a heuristic by its id or name (case-insensitive). */
function signalKey(def: SignalDef): string {
  const hay = `${def.id} ${def.name}`.toLowerCase()
  if (/clarity/.test(hay)) return 'clarity'
  if (/completeness|complete/.test(hay)) return 'completeness'
  if (/brand[\s_-]?safety|safety/.test(hay)) return 'brand_safety'
  if (/hook/.test(hay)) return 'hook_strength'
  if (/character/.test(hay)) return 'character'
  if (/franchise|fit/.test(hay)) return 'franchise_fit'
  return 'generic'
}

function evalClarity(ctx: HeuristicContext): SignalEval {
  const issues: SignalIssue[] = []
  for (const pattern of VAGUE_PATTERNS) {
    const m = ctx.text.match(pattern)
    if (m && m[0]) {
      const quote = exactSubstring(ctx.text, m[0].trim())
      if (quote) {
        issues.push({
          quote,
          message: 'Vague phrasing; describes a feeling rather than concrete detail',
          severity: 'minor',
        })
      }
    }
    if (issues.length >= 2) break
  }
  // Flag a single overly long sentence if nothing vague was caught.
  if (issues.length === 0) {
    const longest = longestSentence(ctx.text)
    if (longest && longest.length > 220) {
      const quote = exactSubstring(ctx.text, longest)
      if (quote) {
        issues.push({
          quote,
          message: 'This sentence is long and may be hard to parse on a first read',
          severity: 'minor',
        })
      }
    }
  }
  const penalty = issues.length * 25
  const score = clampScore(90 - penalty + jitter(ctx.rng))
  const rationale =
    issues.length > 0
      ? 'Some phrasing is vague or describes a feeling rather than concrete detail.'
      : 'Reads cleanly on a first pass; the premise is easy to follow.'
  return { score, rationale, issues }
}

function evalCompleteness(ctx: HeuristicContext): SignalEval {
  const hasAudience = /\b(?:kids?|ages?|audience|family|adults?|teens?|6-12|grown-?ups?)\b/i.test(ctx.text)
  const hasFormat = /\b(?:short|series|film|pilot|episode|feature|youtube|video|minute|movie|webtoon)\b/i.test(ctx.text)
  const hasCharacter = /\b(?:[A-Z][a-z]+|protagonist|lead|character|hero(?:ine)?)\b/.test(ctx.text)
  const hasPremise = ctx.words >= 25
  const present = [hasAudience, hasFormat, hasCharacter, hasPremise].filter(Boolean).length
  const score = clampScore(20 + present * 20 + (ctx.words >= 60 ? 10 : 0) + jitter(ctx.rng))
  const missing: string[] = []
  if (!hasPremise) missing.push('a fuller premise')
  if (!hasAudience) missing.push('a target audience')
  if (!hasFormat) missing.push('a format (short/series/film)')
  const rationale =
    missing.length > 0
      ? `Missing ${missing.join(', ')}.`
      : 'Premise, audience, format, and a main character are all present.'
  return { score, rationale, issues: [] }
}

function evalBrandSafety(ctx: HeuristicContext, threshold: number): SignalEval {
  const issues: SignalIssue[] = []
  const seen = new Set<string>()
  for (const term of RISKY_TERMS) {
    const m = ctx.text.match(term.pattern)
    if (m && m[0]) {
      const quote = exactSubstring(ctx.text, m[0].trim())
      if (quote && !seen.has(quote.toLowerCase())) {
        seen.add(quote.toLowerCase())
        issues.push({ quote, message: term.message, severity: 'risk' })
      }
    }
  }
  // Any hit drops the score well below threshold; more hits, lower score.
  const score =
    issues.length === 0
      ? clampScore(100 + jitter(ctx.rng) * 0.2)
      : clampScore(threshold - 40 - (issues.length - 1) * 15 + Math.abs(jitter(ctx.rng)) * 0.2)
  const rationale =
    issues.length === 0
      ? 'Nothing unsafe or off-brand for a family audience.'
      : 'Contains content that is unsafe or off-brand for a kids 6-12 audience.'
  return { score, rationale, issues }
}

function evalHookStrength(ctx: HeuristicContext): SignalEval {
  const opener = ctx.sentences[0] ?? ctx.text.trim()
  const concrete = /\b(?:secret|midnight|haunted|discovers|when|race|trapped|first|only|last)\b/i.test(opener)
  const punchy = opener.length >= 20 && opener.length <= 200
  const score = clampScore(40 + (concrete ? 30 : 0) + (punchy ? 20 : 0) + jitter(ctx.rng))
  const rationale = concrete
    ? `The opening promises something specific: "${opener.slice(0, 80)}".`
    : 'The opening is serviceable but does not promise an immediate, scroll-stopping payoff.'
  return { score, rationale, issues: [] }
}

function evalCharacter(ctx: HeuristicContext): SignalEval {
  const named = /\b(?:Eloise|Nanny|Weenie|Skipperdee)\b/.test(ctx.text)
  const hasTrait = /\b(?:precocious|mischievous|brave|resourceful|witty|stubborn|curious|quirk|want|wants|distinct)\b/i.test(
    ctx.text,
  )
  const vague = /\b(?:vibe|cool|energy|whatever|some kind)\b/i.test(ctx.text)
  let score = 40 + (named ? 20 : 0) + (hasTrait ? 30 : 0)
  if (vague) score -= 20
  score = clampScore(score + jitter(ctx.rng))
  const rationale = hasTrait
    ? 'The lead has a specific, ownable trait, want, or quirk.'
    : 'The lead is described by feel rather than a specific trait, want, or quirk.'
  return { score, rationale, issues: [] }
}

function evalFranchiseFit(ctx: HeuristicContext): SignalEval {
  const onBrand = /\b(?:playful|family|whimsical|warm|upscale|plaza|eloise|kids?)\b/i.test(ctx.text)
  const offBrand = /\b(?:horror|frightening|body count|jump scares?|grim|violent|mature)\b/i.test(ctx.text)
  let score = 60 + (onBrand ? 20 : 0)
  if (offBrand) score -= 40
  score = clampScore(score + jitter(ctx.rng))
  const rationale = offBrand
    ? 'The tone clashes with the playful, family-safe world this project lives in.'
    : 'Fits the project world, tone, and audience.'
  return { score, rationale, issues: [] }
}

function evalGeneric(ctx: HeuristicContext): SignalEval {
  // Length- and substance-based fallback for custom signals.
  const score = clampScore(50 + (ctx.words >= 40 ? 20 : 0) + (ctx.words >= 80 ? 10 : 0) + jitter(ctx.rng))
  const rationale = 'Evaluated heuristically; no specific concerns detected for this criterion.'
  return { score, rationale, issues: [] }
}

function evaluateSignal(def: SignalDef, ctx: HeuristicContext): SignalResult {
  let result: SignalEval
  switch (signalKey(def)) {
    case 'clarity':
      result = evalClarity(ctx)
      break
    case 'completeness':
      result = evalCompleteness(ctx)
      break
    case 'brand_safety':
      result = evalBrandSafety(ctx, def.threshold)
      break
    case 'hook_strength':
      result = evalHookStrength(ctx)
      break
    case 'character':
      result = evalCharacter(ctx)
      break
    case 'franchise_fit':
      result = evalFranchiseFit(ctx)
      break
    default:
      result = evalGeneric(ctx)
  }
  // `doc`-mode signals never produce inline squiggles.
  const issues = def.mode === 'inline' ? result.issues : []
  return { signalId: def.id, score: result.score, rationale: result.rationale, issues }
}

// --- Verdict -------------------------------------------------------------------

function computeVerdict(signals: SignalResult[], defs: SignalDef[]): ReviewVerdict {
  const thresholdById = new Map(defs.map((d) => [d.id, d.threshold]))
  let flagCount = 0
  let brandSafetyBelow = false
  for (const s of signals) {
    const threshold = thresholdById.get(s.signalId)
    if (threshold === undefined) continue
    if (s.score < threshold) {
      flagCount += 1
      if (/brand[\s_-]?safety|safety/.test(s.signalId.toLowerCase())) brandSafetyBelow = true
    }
  }
  let label: ReviewVerdict['label']
  if (flagCount === 0) label = 'looks_ready'
  else if (brandSafetyBelow || flagCount >= 4) label = 'not_ready'
  else label = 'needs_work'
  return { label, flagCount }
}

// --- Overall summary + suggested prompt ----------------------------------------
// Deterministic, derived purely from the computed review (verdict, the lowest-
// scoring signals below threshold, and any brand-safety risks). Same review in →
// same summary/prompt out. No PRNG here, so it stays byte-stable.

/** Human-friendly label for a signal, derived from its def (id/name fallback). */
function signalLabel(def: SignalDef): string {
  return def.name?.trim() || def.id
}

/** The signals scoring below their threshold, weakest first, with their defs. */
function flaggedSignals(
  signals: SignalResult[],
  defs: SignalDef[],
): Array<{ result: SignalResult; def: SignalDef }> {
  const defById = new Map(defs.map((d) => [d.id, d]))
  return signals
    .flatMap((result) => {
      const def = defById.get(result.signalId)
      if (!def || result.score >= def.threshold) return []
      return [{ result, def }]
    })
    .sort((a, b) => a.result.score - b.result.score)
}

/** Join names like ["a", "b", "c"] → "a, b and c". */
function joinNames(names: string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Build a 1-3 sentence "what to do" summary plus a ready-to-paste AI prompt. Both
 * are deterministic functions of the computed review — they reference the lowest-
 * scoring signals and call out any brand-safety risk specifically.
 */
function buildSummary(
  signals: SignalResult[],
  defs: SignalDef[],
  verdict: ReviewVerdict,
): { summary: string; suggestedPrompt: string } {
  const flagged = flaggedSignals(signals, defs)
  const brandSafety = flagged.find((f) => /brand[\s_-]?safety|safety/.test(f.def.id.toLowerCase()))
  // Up to three weakest signals, brand safety always surfaced first if present.
  const focus = brandSafety
    ? [brandSafety, ...flagged.filter((f) => f !== brandSafety)].slice(0, 3)
    : flagged.slice(0, 3)
  const focusNames = focus.map((f) => signalLabel(f.def))

  let summary: string
  let suggestedPrompt: string

  if (flagged.length === 0) {
    summary =
      'This reads as ready — every signal is at or above its threshold. Give it a final proofread for tone and consistency before you submit.'
    suggestedPrompt =
      'Lightly polish the following creative concept for tone and clarity without changing its meaning, audience, or any specific details. Keep it family-appropriate and on-brand:'
  } else if (brandSafety) {
    const others = focusNames.filter((n) => n !== signalLabel(brandSafety.def))
    const tail = others.length > 0 ? ` Also tighten ${joinNames(others)}.` : ''
    summary = `Brand Safety is below threshold, so this isn't ready as written — rewrite or remove the unsafe content before resubmitting.${tail}`
    suggestedPrompt =
      'Rewrite the following creative concept to be fully family-safe and on-brand for the target audience. Remove or replace any violent, scary, mature, or off-brand content while preserving the core premise and the parts that work. Return only the revised concept:'
  } else {
    const verb = verdict.label === 'not_ready' ? 'needs significant work' : 'needs some work'
    summary = `This ${verb}: ${joinNames(focusNames)} ${focusNames.length === 1 ? 'is' : 'are'} below threshold. Revise ${focusNames.length === 1 ? 'that area' : 'those areas'} and resubmit.`
    suggestedPrompt = `Revise the following creative concept to strengthen ${joinNames(focusNames)}. Be concrete and specific, keep the audience and format intact, and stay on-brand. Return only the revised concept:`
  }

  return { summary, suggestedPrompt }
}

// --- Provider ------------------------------------------------------------------

export class MockProvider implements ReviewProvider {
  async review(input: ReviewInput): Promise<ReviewResult> {
    return reviewSync(input)
  }

  async applyEdit(input: ApplyInput): Promise<string> {
    return applyEditSync(input)
  }
}

// --- Deterministic "apply suggested prompt" edit -------------------------------
// The mock has no LLM, so it makes a SMALL but VISIBLE, deterministic rewrite of the
// author's text guided by the instruction: it trims hedging filler and prepends one
// tightened clarifying opening line whose verb is chosen from the instruction. Same
// (text, instruction) in → byte-identical text out. It is never a pure echo: the
// opening line is always added, so the returned text differs from the input.

// Trimming filler is deliberately conservative: it must NEVER delete words from the
// middle of the author's prose or dialogue, where words like "just", "really",
// "I think", or "you know" carry real meaning (e.g. '"I think we should run"' or
// '"you know the rules"'). So we only ever remove hedging that *opens* the text or a
// sentence, plus a tiny set of standalone intensifiers that are filler in any position.

/**
 * Standalone intensifiers that add no meaning wherever they appear — safe to drop
 * anywhere because removing them never changes the substance of a clause.
 */
const STANDALONE_FILLER = /\b(?:basically|literally)\b/gi

/**
 * Leading hedging that only counts as filler when it *opens* the text or a sentence.
 * Matched at the start of the string or right after sentence punctuation / a newline,
 * so mid-sentence occurrences (and dialogue) are left untouched.
 */
const LEADING_HEDGES = [
  'really',
  'just',
  'honestly',
  'maybe',
  'somehow',
  'i think',
  'you know',
  'kind of',
  'sort of',
  'of course',
  'well',
  'so',
]
const LEADING_HEDGE_PATTERN = new RegExp(
  // Group 1: the sentence boundary we keep (start of string, or sentence punctuation /
  // newline plus any opening quote and whitespace). Group 2: the first letter of the
  // word now exposed at sentence start, which we re-capitalise.
  `(^|[.!?]["')\\]]?\\s+|\\n[ \\t]*)(?:${LEADING_HEDGES.join('|')})\\b,?[ \\t]+([a-z])`,
  'gi',
)

/**
 * Trim hedging filler conservatively: drop standalone intensifiers anywhere, then drop
 * leading hedges only where they open the text or a sentence. Re-capitalises the first
 * letter of any sentence whose opener was removed so the prose still reads cleanly.
 * Mid-sentence "just" / "really" / "I think" / "you know" are left untouched.
 */
function trimFiller(text: string): string {
  const withoutStandalone = text.replace(STANDALONE_FILLER, '')
  return withoutStandalone.replace(
    LEADING_HEDGE_PATTERN,
    (_match, boundary: string, firstLetter: string) => `${boundary}${firstLetter.toUpperCase()}`,
  )
}

/** Collapse the whitespace left behind after trimming filler words. */
function tidyWhitespace(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/[ \t]+$/g, ''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Choose a leading verb for the clarifying line from the instruction, so the edit
 * visibly reflects what was asked (e.g. "make it safer" → "Refocus"). Deterministic:
 * first matching rule in order wins, with a stable default.
 */
function clarifyingVerb(instruction: string): string {
  const i = instruction.toLowerCase()
  if (/\b(safe|family|brand|remove|replace)\b/.test(i)) return 'Refocus'
  // `simpl\w*` (not `simpl\b`) so simplify/simple/simpler match — a trailing `\b`
  // after `simpl` can never match because a letter always follows it.
  if (/\b(?:clear|clarity|concise|tighten|simpl\w*)\b/.test(i)) return 'Tighten'
  if (/\b(hook|open|grab|attention)\b/.test(i)) return 'Sharpen'
  if (/\b(character|protagonist|hero|lead)\b/.test(i)) return 'Ground'
  if (/\b(complete|detail|expand|flesh)\b/.test(i)) return 'Anchor'
  return 'Revise'
}

/**
 * Deterministic, LLM-free rewrite for the demo. Trims filler and prepends a single
 * tightened clarifying opening line derived from the instruction and the text's own
 * subject (its suggested title). Returns plain text; same input → same output.
 */
export function applyEditSync(input: ApplyInput): string {
  const { text, instruction } = input
  const body = tidyWhitespace(trimFiller(text))
  const subject = suggestTitle(body || text)
  const verb = clarifyingVerb(instruction)
  // One concrete clarifying line that names the subject and the asked-for direction.
  const opener = `${verb} "${subject}" so the intent is unmistakable on the first read.`
  return body.length > 0 ? `${opener}\n\n${body}` : opener
}

/** Pure, synchronous core — handy for tests that want a value without a promise. */
export function reviewSync(input: ReviewInput): ReviewResult {
  const { text, signals } = input
  const rng = makeRng(hashString(text))
  const ctx: HeuristicContext = {
    text,
    words: wordCount(text),
    sentences: splitSentences(text),
    first: firstLine(text),
    rng,
  }
  const signalResults = signals.map((def) => evaluateSignal(def, ctx))
  const verdict = computeVerdict(signalResults, signals)
  const { summary, suggestedPrompt } = buildSummary(signalResults, signals, verdict)
  return {
    detectedSubtype: detectSubtype(text),
    suggestedTitle: suggestTitle(text),
    themes: extractThemes(text),
    signals: signalResults,
    verdict,
    summary,
    suggestedPrompt,
  }
}
