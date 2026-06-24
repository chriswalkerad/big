// The contract every review provider implements. The API route selects a concrete
// provider (Gemini when a key is present, otherwise the mock) and calls `review` or
// `applyEdit`. See specs/bsp-backend-build-spec.md.

import type { Project, ReviewResult, SignalDef } from '@/types'

export interface ReviewInput {
  text: string
  project: Project
  signals: SignalDef[]
}

/** Input for `applyEdit`: rewrite `text` to satisfy `instruction`. */
export interface ApplyInput {
  text: string
  instruction: string
  project: Project
}

export interface ReviewProvider {
  review(input: ReviewInput): Promise<ReviewResult>
  /**
   * Rewrite the author's `text` to satisfy `instruction`, returning the rewritten
   * PLAIN TEXT (no JSON, no markdown fences, no preamble). Failures are mapped to
   * typed AppErrors.
   */
  applyEdit(input: ApplyInput): Promise<string>
}
