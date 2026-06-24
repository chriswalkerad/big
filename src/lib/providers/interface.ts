// The contract every review provider implements. The API route selects a concrete
// provider (Gemini when a key is present, otherwise the mock) and calls `review`.
// See specs/bsp-backend-build-spec.md.

import type { Project, ReviewResult, SignalDef } from '@/types'

export interface ReviewInput {
  text: string
  project: Project
  signals: SignalDef[]
}

export interface ReviewProvider {
  review(input: ReviewInput): Promise<ReviewResult>
}
