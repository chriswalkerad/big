// Client-side wrapper for POST /api/apply. Keeps fetch/parse/error-mapping out of the
// page component and returns the same discriminated ApplyResponse the route emits, so
// callers branch on `result.ok`. Never throws — network and parse failures are mapped
// to typed AppErrors. Mirrors review-client.ts.

import type { ApplyRequest, ApplyResponse, Project } from '@/types'
import { isAppError, toAppError } from '@/lib/errors'

export interface RequestApplyArgs {
  text: string
  instruction: string
  project: Project
  /** Inject fetch for tests; defaults to the global. */
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

/**
 * Submit a text + instruction for an AI rewrite. Returns `{ ok: true, data }` on
 * success or `{ ok: false, error }` for any failure (HTTP, network, or malformed
 * JSON).
 */
export async function requestApply({
  text,
  instruction,
  project,
  fetchImpl,
  signal,
}: RequestApplyArgs): Promise<ApplyResponse> {
  const doFetch = fetchImpl ?? fetch
  const payload: ApplyRequest = { text, instruction, project }

  let response: Response
  try {
    response = await doFetch('/api/apply', {
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

  // The route always returns an ApplyResponse shape (even on non-2xx). Trust it when
  // it is well-formed; otherwise fall back to a typed error from the status.
  if (isApplyResponse(json)) return json
  return { ok: false, error: toAppError(new Error(`Apply failed (${response.status}).`)) }
}

function isApplyResponse(value: unknown): value is ApplyResponse {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false
  const ok = (value as { ok: unknown }).ok
  if (ok === true) {
    if (!('data' in value)) return false
    const data = (value as { data: unknown }).data
    return (
      typeof data === 'object' &&
      data !== null &&
      'text' in data &&
      typeof (data as { text: unknown }).text === 'string'
    )
  }
  if (ok === false) return 'error' in value && isAppError((value as { error: unknown }).error)
  return false
}
