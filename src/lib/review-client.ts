// Client-side wrapper for POST /api/review. Keeps fetch/parse/error-mapping out of
// the page component and returns the same discriminated ReviewResponse the route
// emits, so callers branch on `result.ok`. Never throws — network and parse failures
// are mapped to typed AppErrors.

import type { Project, ReviewRequest, ReviewResponse, SignalDef } from '@/types'
import { isAppError, toAppError } from '@/lib/errors'

export interface RequestReviewArgs {
  text: string
  project: Project
  signals: SignalDef[]
  /** Inject fetch for tests; defaults to the global. */
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

/**
 * Submit a body for review. Returns `{ ok: true, data }` on success or
 * `{ ok: false, error }` for any failure (HTTP, network, or malformed JSON).
 */
export async function requestReview({
  text,
  project,
  signals,
  fetchImpl,
  signal,
}: RequestReviewArgs): Promise<ReviewResponse> {
  const doFetch = fetchImpl ?? fetch
  const payload: ReviewRequest = { text, project, signals }

  let response: Response
  try {
    response = await doFetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (e) {
    // Network failure / abort before any response.
    return { ok: false, error: toAppError(e) }
  }

  let json: unknown
  try {
    json = await response.json()
  } catch (e) {
    return { ok: false, error: toAppError(e) }
  }

  // The route always returns a ReviewResponse shape (even on non-2xx). Trust it when
  // it is well-formed; otherwise fall back to a typed error from the status.
  if (isReviewResponse(json)) return json
  return { ok: false, error: toAppError(new Error(`Review failed (${response.status}).`)) }
}

function isReviewResponse(value: unknown): value is ReviewResponse {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false
  const ok = (value as { ok: unknown }).ok
  if (ok === true) return 'data' in value
  if (ok === false) return 'error' in value && isAppError((value as { error: unknown }).error)
  return false
}
