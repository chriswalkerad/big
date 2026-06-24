// Core logic for POST /api/review, factored out of the Next route handler so it can
// be unit-tested directly (the route stays a thin Web Request/Response wrapper). It
// validates the request body, short-circuits empty text, runs the selected provider,
// re-validates the provider's output, and always returns a typed ReviewResponse —
// it never throws. See specs/bsp-backend-build-spec.md.

import type { ReviewResponse } from '@/types'
import { appError, toAppError } from '@/lib/errors'
import { reviewRequestSchema, reviewResultSchema } from '@/lib/schemas'
import type { ReviewProvider } from '@/lib/providers/interface'
import { type ProviderEnv, selectProvider } from '@/lib/providers/select'

export interface HandleReviewDeps {
  env?: ProviderEnv
  /** Inject a provider (tests). Defaults to env-based selection. */
  provider?: ReviewProvider
}

/**
 * Run a review for an already-parsed request body. Returns a discriminated
 * ReviewResponse; callers serialize it as JSON. Never throws.
 */
export async function handleReview(body: unknown, deps: HandleReviewDeps = {}): Promise<ReviewResponse> {
  // 1. Validate the request body.
  const parsedRequest = reviewRequestSchema.safeParse(body)
  if (!parsedRequest.success) {
    return {
      ok: false,
      error: appError('UNKNOWN', 'Invalid review request.', parsedRequest.error.issues),
    }
  }
  const input = parsedRequest.data

  // 2. Whitespace-only text is a user error, not a provider call.
  if (input.text.trim().length === 0) {
    return { ok: false, error: appError('EMPTY_DOC') }
  }

  // 3. Select and run the provider.
  let raw: unknown
  try {
    const provider = deps.provider ?? selectProvider(deps.env ?? process.env)
    raw = await provider.review(input)
  } catch (e) {
    return { ok: false, error: toAppError(e) }
  }

  // 4. Re-validate the provider's output. Trust nothing that crossed the boundary.
  const parsedResult = reviewResultSchema.safeParse(raw)
  if (!parsedResult.success) {
    return {
      ok: false,
      error: appError('AI_BAD_JSON', "The model's response did not match the expected shape.", parsedResult.error.issues),
    }
  }

  return { ok: true, data: parsedResult.data }
}
