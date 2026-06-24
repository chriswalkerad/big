// Pure, framework-free logic for the document page: verdict/flag formatting,
// signal-bar color, version-drift detection, the status state machine, and the
// submit-prefill rules. Kept here (no React, no DOM) so it is unit-testable in
// isolation and reused by the page component, the results drawer, and the tests.
// See specs/bsp-frontend-build-spec.md (screens 2 + 3) and src/types/index.ts.

import type {
  Document,
  ReviewResult,
  SignalDef,
  SignalIssue,
  SignalResult,
  SubmissionStatus,
  SubmittedSnapshot,
  TextSubtype,
  VerdictLabel,
} from '@/types'
import type { SignalHighlightIssue } from '@/components/editor/SignalHighlight'

// --- Verdict + flag formatting -------------------------------------------------

/** Human-readable label for each verdict (drawer header). */
export const VERDICT_LABELS: Record<VerdictLabel, string> = {
  looks_ready: 'Looks ready',
  needs_work: 'Needs work',
  not_ready: 'Not ready',
}

/** A "needs work" / "not ready" verdict is made visually prominent (never a hard block). */
export function isVerdictProminent(label: VerdictLabel): boolean {
  return label === 'needs_work' || label === 'not_ready'
}

/**
 * Flag-count summary for the drawer header, e.g. "2 of 6 need attention".
 * A signal "needs attention" when it scores below its own threshold. The total is
 * the number of signals reviewed. Computed on submit only, never live.
 */
export function formatFlagCount(flagCount: number, totalSignals: number): string {
  return `${flagCount} of ${totalSignals} need attention`
}

// --- Signal bar color ----------------------------------------------------------

export type BarTone = 'pass' | 'minor' | 'risk'

/**
 * A signal's fill color relative to its OWN threshold:
 *   - green  (`pass`)  when score >= threshold
 *   - amber  (`minor`) when 1-2 below threshold
 *   - red    (`risk`)  when 3+ below threshold
 */
export function barTone(score: number, threshold: number): BarTone {
  if (score >= threshold) return 'pass'
  const gap = threshold - score
  if (gap <= 2) return 'minor'
  return 'risk'
}

/** Token-backed text/background class fragments per tone (no hard-coded hex). */
export const BAR_TONE_BG: Record<BarTone, string> = {
  pass: 'bg-pass',
  minor: 'bg-minor',
  risk: 'bg-risk',
}

/** Proportional fill width (0-100%) for a score out of ten, clamped. */
export function barFillPercent(score: number, max = 10): number {
  if (max <= 0) return 0
  const pct = (score / max) * 100
  return Math.max(0, Math.min(100, pct))
}

// --- Version drift -------------------------------------------------------------

/**
 * Drift = the live working body differs from the submitted snapshot's body.
 * No snapshot → no drift (nothing to drift from).
 */
export function hasDrift(body: string, snapshot: SubmittedSnapshot | undefined): boolean {
  if (!snapshot) return false
  return body !== snapshot.body
}

// --- Status state machine (EPIC 14) --------------------------------------------

/**
 * Allowed status transitions. Author submit/unsubmit and reviewer actions all flow
 * through here; only listed edges are legal. First submit from `draft` auto-moves
 * to `submitted` (see `statusAfterSubmit`).
 */
const TRANSITIONS: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  // Author submits a draft.
  draft: ['submitted'],
  // Reviewer picks up a submitted doc, or author unsubmits / resubmits it.
  submitted: ['in_review', 'changes_requested', 'approved', 'draft'],
  // Reviewer decisions from in-review; author can still unsubmit.
  in_review: ['changes_requested', 'approved', 'draft'],
  // After changes requested, author can unsubmit; reviewer can still move it.
  changes_requested: ['in_review', 'approved', 'draft'],
  // Approved can be reopened for review or unsubmitted.
  approved: ['in_review', 'changes_requested', 'draft'],
}

/** True when `from → to` is a legal status transition (identity is always allowed). */
export function canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
  if (from === to) return true
  return TRANSITIONS[from].includes(to)
}

/** The reviewer-facing status options offered in read mode. */
export const REVIEWER_STATUSES: readonly SubmissionStatus[] = [
  'in_review',
  'changes_requested',
  'approved',
]

/**
 * Status after a (re)submit. A `draft` auto-advances to `submitted`; any other
 * status is preserved (resubmit keeps the reviewer's current status).
 */
export function statusAfterSubmit(current: SubmissionStatus): SubmissionStatus {
  return current === 'draft' ? 'submitted' : current
}

// --- Submit prefill (respecting `user` sources) --------------------------------

export interface PrefillResult {
  title: string
  subtype: TextSubtype
  subtypeSource: 'auto' | 'user'
}

/**
 * Apply AI prefill from a review, respecting locked-in user choices:
 *   - title: filled from `suggestedTitle` only when currently empty/whitespace.
 *   - subtype: overwritten by `detectedSubtype` only while the source is `auto`;
 *     once the user has picked a subtype (`user`) the AI never overrides it.
 */
export function applyPrefill(
  doc: Pick<Document, 'title' | 'subtype' | 'subtypeSource'>,
  review: ReviewResult,
): PrefillResult {
  const title = doc.title.trim() ? doc.title : review.suggestedTitle
  const keepUserSubtype = doc.subtypeSource === 'user'
  return {
    title,
    subtype: keepUserSubtype ? doc.subtype : review.detectedSubtype,
    subtypeSource: doc.subtypeSource,
  }
}

// --- Inline highlight mapping --------------------------------------------------

/**
 * Tag every inline issue with the id of the signal that produced it, flattening the
 * per-signal results into the `SignalHighlightIssue[]` the canvas overlay consumes.
 * Only inline-mode signals (Clarity, Brand Safety) carry squiggles; doc-level
 * signals (e.g. Hook Strength) never do, so we filter by the provided inline ids.
 */
export function toHighlightIssues(
  signals: readonly SignalResult[],
  inlineSignalIds: ReadonlySet<string>,
): SignalHighlightIssue[] {
  const out: SignalHighlightIssue[] = []
  for (const signal of signals) {
    if (!inlineSignalIds.has(signal.signalId)) continue
    for (const issue of signal.issues) {
      out.push({ ...issue, signalId: signal.signalId })
    }
  }
  return out
}

/** Build the set of inline-mode signal ids from the signal definitions. */
export function inlineSignalIdSet(signals: readonly SignalDef[]): Set<string> {
  return new Set(signals.filter((s) => s.mode === 'inline').map((s) => s.id))
}

// --- Snapshot construction -----------------------------------------------------

/** A fresh submitted snapshot from the reviewed body + result. */
export function makeSnapshot(
  body: string,
  review: ReviewResult,
  submittedAt: string,
): SubmittedSnapshot {
  return { body, review, submittedAt }
}

// --- Signal lookup helpers -----------------------------------------------------

/** Index signal definitions by id for O(1) lookup when rendering rows. */
export function signalDefMap(signals: readonly SignalDef[]): Map<string, SignalDef> {
  return new Map(signals.map((s) => [s.id, s]))
}

/** Issues for a single signal, useful when listing flagged phrases in a row. */
export function issuesForSignal(signal: SignalResult): SignalIssue[] {
  return signal.issues
}
