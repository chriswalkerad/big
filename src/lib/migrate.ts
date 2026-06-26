// One-time, idempotent migration of PERSISTED user data to the post-redesign
// shapes. User-created documents that predate the redesign keep stale shapes that
// seedIfStale() never touches (it only upserts SEED ids). This module walks EVERY
// stored document and brings each forward:
//   1. Rescale 0–10 review scores/thresholds → 0–100 (×10). Display now assumes
//      0–100, so an un-migrated 9 renders as a ~9% empty red bar + failing verdict.
//   2. `reviewer` persisted as a bare string (id/name) → a `Person` from the
//      roster, or `undefined` when unresolvable (code derefs `doc.reviewer.name`).
//   3. Strip a trailing "[paste your text here]" placeholder from `suggestedPrompt`
//      (Apply garbles + double-sends the body otherwise).
//
// Driven by a GLOBAL marker (`bsp:meta:migrated` = MIGRATION_VERSION). The rescale is
// the only non-idempotent transform, so each record ALSO carries a per-record
// `migratedVersion` stamp: a record already stamped at the current version is returned
// untouched. This closes a re-run window — if a pass degrades mid-loop (quota →
// in-memory store), the GLOBAL marker write lands in memory and is lost on reload while
// some records were already rescaled and persisted; on the next load the per-record
// stamp (persisted alongside each rescaled record) makes re-migration a true no-op, so
// no record can be double-rescaled even with the global marker gone. Pure transforms
// here; StorageRepository owns the I/O.

import type { Document, Person, ReviewResult, SignalDef, SignalResult } from '@/types'
import { PEOPLE } from '@/lib/people'

/**
 * Persisted-data migration version. Bump when a new structural migration is added.
 * Stored as a plain string marker under `bsp:meta:migrated`; a mismatch (or absence)
 * triggers a single full pass over all documents and signals.
 */
export const MIGRATION_VERSION = 1

/**
 * The scale boundary. Pre-redesign scores/thresholds lived on 0–10; the redesign
 * moved everything to 0–100.
 *
 * Heuristic (per-record, not per-value): within ONE review every signal shares the
 * same scale, so a record is old-scale iff its HIGHEST signal score is still ≤ 10.
 * A legitimate new-scale review almost always has at least one score above 10 (the
 * seed alone ranges to 100), and a value-by-value test would wrongly rescale a real
 * 0–100 score that happens to be ≤ 10 (e.g. a seeded `10`). Checking the per-record
 * max avoids that. This heuristic only ever runs once per record now: the per-record
 * `migratedVersion` stamp short-circuits any already-migrated record before we reach
 * it, so even an edge value that the heuristic would misjudge can't be re-scaled on a
 * later pass. Thresholds use the same boundary.
 */
const OLD_SCALE_MAX = 10

/** Rescale a single 0–10 value to 0–100, clamped to a whole percentage in range. */
function rescale(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10)))
}

/**
 * Resolve a persisted reviewer (which may be a bare string id/name from before
 * `Person` was introduced, or an already-correct `Person`) to a roster `Person`,
 * or `undefined` when it cannot be resolved.
 */
export function resolveReviewer(reviewer: unknown): Person | undefined {
  if (reviewer == null) return undefined
  if (typeof reviewer === 'string') {
    const key = reviewer.trim().toLowerCase()
    if (key.length === 0) return undefined
    return (
      PEOPLE.find((p) => p.id.toLowerCase() === key) ??
      PEOPLE.find((p) => p.name.toLowerCase() === key)
    )
  }
  if (typeof reviewer === 'object') {
    const candidate = reviewer as Partial<Person>
    if (typeof candidate.id === 'string' && typeof candidate.name === 'string') {
      // Already a Person-shaped object; prefer the canonical roster entry by id so
      // a stale `role`/`name` is refreshed, but keep it as-is if off-roster.
      return PEOPLE.find((p) => p.id === candidate.id) ?? (candidate as Person)
    }
  }
  return undefined
}

const PLACEHOLDER_RE = /\s*\[paste your text here\]\s*$/i

/** Strip a trailing "[paste your text here]" placeholder (and surrounding blank lines). */
export function stripPromptPlaceholder(prompt: string): string {
  return prompt.replace(PLACEHOLDER_RE, '').trimEnd()
}

function migrateReview(review: ReviewResult): ReviewResult {
  // Per-record decision: rescale the whole review iff its top score is old-scale.
  const isOldScale =
    review.signals.length > 0 &&
    review.signals.every((s) => s.score <= OLD_SCALE_MAX)
  const signals: SignalResult[] = isOldScale
    ? review.signals.map((s) => ({ ...s, score: rescale(s.score) }))
    : review.signals
  const next: ReviewResult = { ...review, signals }
  if (typeof next.suggestedPrompt === 'string') {
    next.suggestedPrompt = stripPromptPlaceholder(next.suggestedPrompt)
  }
  return next
}

/**
 * Migrate a single document to the current shape. Pure: returns a new document
 * (never mutates input). IDEMPOTENT across passes: a record already stamped at the
 * current MIGRATION_VERSION is returned unchanged, so re-running after a partial or
 * degraded pass (where the global marker was lost) can never double-rescale.
 */
export function migrateDocument(doc: Document): Document {
  if (doc.migratedVersion === MIGRATION_VERSION) return doc
  const next: Document = {
    ...doc,
    reviewer: resolveReviewer(doc.reviewer),
    migratedVersion: MIGRATION_VERSION,
  }
  if (doc.submittedSnapshot) {
    next.submittedSnapshot = {
      ...doc.submittedSnapshot,
      review: migrateReview(doc.submittedSnapshot.review),
    }
  }
  return next
}

/**
 * Migrate a signal definition: rescale an old-scale threshold to 0–100. IDEMPOTENT
 * across passes via the per-record `migratedVersion` stamp (see migrateDocument).
 */
export function migrateSignal(signal: SignalDef): SignalDef {
  if (signal.migratedVersion === MIGRATION_VERSION) return signal
  const next =
    signal.threshold <= OLD_SCALE_MAX ? { ...signal, threshold: rescale(signal.threshold) } : { ...signal }
  next.migratedVersion = MIGRATION_VERSION
  return next
}
