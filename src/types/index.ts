// Shared types — the single source of truth. Both the server (API route, providers)
// and the client (StorageRepository, UI) import from here. Keep in sync with
// specs/bsp-backend-build-spec.md.

export type TextSubtype =
  | 'story_premise'
  | 'character_concept'
  | 'world_building'
  | 'script_excerpt'
  | 'creative_brief'

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'changes_requested'
  | 'approved'

export type RoutingDestination =
  | 'digital_test'
  | 'animation'
  | 'marketing'
  | 'development'
  | 'production'

export type SignalMode = 'inline' | 'doc'

export type Severity = 'risk' | 'minor'

/** A member of the creative department (project owner or document reviewer). */
export interface Person {
  id: string
  name: string
  role: string
}

export interface Project {
  id: string
  name: string
  audience: string
  franchiseContext: string
  tags: string[]
  /** The person who created the project. */
  owner: Person
}

export interface SignalDef {
  id: string
  name: string
  prompt: string
  threshold: number
  mode: SignalMode
}

export interface SignalIssue {
  quote: string
  message: string
  severity: Severity
}

export interface SignalResult {
  signalId: string
  score: number
  rationale: string
  issues: SignalIssue[]
}

export type VerdictLabel = 'looks_ready' | 'needs_work' | 'not_ready'

export interface ReviewVerdict {
  label: VerdictLabel
  flagCount: number
}

// Signal bar rule (mirrors design tokens): scores are on a 0–100 scale; fill bar is
// proportional to score/100; fill color = green if score >= threshold, amber if up to
// 20 below, red if more than 20 below.
// Verdict rule: looks_ready = no signals below threshold; not_ready = any Brand
// Safety below threshold OR 4+ flags; needs_work = everything else.

export interface ReviewResult {
  detectedSubtype: TextSubtype
  suggestedTitle: string
  themes: string[]
  signals: SignalResult[]
  verdict: ReviewVerdict
  /** A short (1-3 sentence) "what to do" summary of the review. Optional so older snapshots stay valid. */
  summary?: string
  /** A ready-to-paste AI prompt the author can apply to their text to improve it. Optional. */
  suggestedPrompt?: string
}

// The frozen version that is "in review". A snapshot, NOT a live pointer. Editing
// `body` never touches this. Resubmit REPLACES it (no history). Unsubmit clears it.
export interface SubmittedSnapshot {
  body: string
  review: ReviewResult
  submittedAt: string
}

export interface Document {
  id: string
  projectId: string
  title: string
  /** The author's LIVE working copy. */
  body: string
  /** The text subtype; `null` on a fresh draft until detected or chosen. */
  subtype: TextSubtype | null
  subtypeSource: 'auto' | 'user'
  status: SubmissionStatus
  routing?: RoutingDestination
  createdBy: string
  /** The reviewer chosen at submission. Drafts have none. */
  reviewer?: Person
  submittedSnapshot?: SubmittedSnapshot
  createdAt: string
  updatedAt: string
}

/** Request body for POST /api/review. */
export interface ReviewRequest {
  text: string
  project: Project
  signals: SignalDef[]
}

/** Discriminated response from POST /api/review. */
export type ReviewResponse =
  | { ok: true; data: ReviewResult }
  | { ok: false; error: import('@/lib/errors').AppError }

/**
 * Request body for POST /api/apply. The AI rewrites `text` to satisfy
 * `instruction` (typically a review's suggestedPrompt) and returns plain text.
 */
export interface ApplyRequest {
  text: string
  instruction: string
  project: Project
}

/** Successful payload from POST /api/apply: the rewritten document text. */
export interface ApplyResult {
  text: string
}

/** Discriminated response from POST /api/apply. */
export type ApplyResponse =
  | { ok: true; data: ApplyResult }
  | { ok: false; error: import('@/lib/errors').AppError }

/** Successful payload from POST /api/transcribe: the transcribed text. */
export interface TranscribeResult {
  text: string
}

/** Discriminated response from POST /api/transcribe (voice dictation). */
export type TranscribeResponse =
  | { ok: true; data: TranscribeResult }
  | { ok: false; error: import('@/lib/errors').AppError }

/** Response from GET /api/transcribe — whether speech-to-text is configured. */
export interface TranscribeAvailability {
  available: boolean
}

/** Successful payload from GET /api/speech-token: a short-lived Azure Speech
 * token + the region the real-time Speech SDK needs. The subscription key stays
 * server-side; the client only ever receives this token. */
export interface SpeechTokenResult {
  token: string
  region: string
}

/** Discriminated response from GET /api/speech-token (streaming voice dictation).
 * A successful mint doubles as the availability probe. */
export type SpeechTokenResponse =
  | { ok: true; data: SpeechTokenResult }
  | { ok: false; error: import('@/lib/errors').AppError }
